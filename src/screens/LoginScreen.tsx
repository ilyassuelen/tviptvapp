import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Safe fallback for TVEventHandler to prevent crashes on unsupported devices
const SafeTVEventHandler = (() => {
  try {
    const { TVEventHandler } = require("react-native");
    return TVEventHandler;
  } catch {
    return class {
      enable() {}
      disable() {}
    };
  }
})();

function useTVNavigation(actions: Array<() => void>) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tvEventHandler = useRef<any>(null);

  useEffect(() => {
    tvEventHandler.current = new SafeTVEventHandler();
    tvEventHandler.current.enable(null, (cmp, evt) => {
      if (!evt || !evt.eventType) return;
      if (evt.eventType === "right") setFocusedIndex((prev) => Math.min(prev + 1, actions.length - 1));
      if (evt.eventType === "left") setFocusedIndex((prev) => Math.max(prev - 1, 0));
      if (evt.eventType === "select") actions[focusedIndex]?.();
    });
    return () => tvEventHandler.current?.disable();
  }, [focusedIndex, actions]);

  return focusedIndex;
}

export default function LoginScreen({ navigation }: any) {
  const [accountTitle, setAccountTitle] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const buttonActions = [handleLogin];
  const focusedIndex = useTVNavigation(buttonActions);

  async function handleLogin() {
    if (!accountTitle.trim()) {
      Alert.alert("Fehlender Account-Titel", "Bitte gib einen Namen für diesen Account an.");
      return;
    }
    if (!serverUrl || !username || !password) {
      Alert.alert("Fehlende Angaben", "Bitte fülle alle Felder aus.");
      return;
    }

    try {
      setLoading(true);

      const formattedUrl = serverUrl.endsWith("/")
        ? serverUrl.slice(0, -1)
        : serverUrl;

      // IPTV-Verbindung testen
      const testUrl = `${formattedUrl}/player_api.php?username=${encodeURIComponent(
        username
      )}&password=${encodeURIComponent(password)}`;
      const response = await fetch(testUrl);
      if (!response.ok) {
        throw new Error("Fehlerhafte Server-Antwort");
      }

      const data = await response.json();
      if (!data || !data.user_info || data.user_info.status !== "Active") {
        throw new Error("Ungültige Login-Daten oder Account nicht aktiv.");
      }

      // Session speichern
      const newSession = {
        serverUrl: formattedUrl,
        username,
        password,
        title: accountTitle.trim(),
      };

      // Bestehende Accounts laden
      const stored = await AsyncStorage.getItem("iptv_accounts");
      let accounts = stored ? JSON.parse(stored) : [];

      // Prüfen, ob Titel bereits existiert
      const existingIndex = accounts.findIndex(
        (a: any) => a.title.toLowerCase() === accountTitle.trim().toLowerCase()
      );

      if (existingIndex >= 0) {
        // bestehenden Account überschreiben
        accounts[existingIndex] = newSession;
      } else {
        // neuen Account hinzufügen
        accounts.push(newSession);
      }

      await AsyncStorage.setItem("iptv_accounts", JSON.stringify(accounts));

      // Diesen Account als aktiv setzen
      const activeIndex =
        existingIndex >= 0 ? existingIndex : accounts.length - 1;
      await AsyncStorage.setItem(
        "active_account_index",
        String(activeIndex)
      );

      // Auch aktuelle Session speichern (für Homescreen-Ladevorgänge)
      await AsyncStorage.setItem("iptv_session", JSON.stringify(newSession));
      await AsyncStorage.setItem("active_account_index", "0");

      Alert.alert("✅ Erfolgreich verbunden", `Account „${accountTitle}“ wurde gespeichert.`);
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err: any) {
      console.error("❌ Login-Fehler:", err);
      Alert.alert("Fehler", err.message || "Login fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>IPTV Login</Text>

        {/* 🔸 Account-Titel */}
        <TextInput
          placeholder="Account-Titel (z. B. Wohnzimmer)"
          placeholderTextColor="#777"
          style={styles.input}
          value={accountTitle}
          onChangeText={setAccountTitle}
        />

        {/* Server, Username, Passwort */}
        <TextInput
          placeholder="Serveradresse (z. B. http://example.com:8080)"
          placeholderTextColor="#777"
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Benutzername"
          placeholderTextColor="#777"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          placeholder="Passwort"
          placeholderTextColor="#777"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[
            styles.loginButton,
            {
              borderWidth: focusedIndex === 0 ? 3 : 0,
              borderColor: focusedIndex === 0 ? "#E50914" : "transparent",
            },
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginText}>Anmelden</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 40,
  },
  input: {
    width: "100%",
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  loginButton: {
    width: "100%",
    backgroundColor: "#E50914",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  loginText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});