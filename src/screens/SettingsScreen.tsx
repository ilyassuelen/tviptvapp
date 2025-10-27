import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [selectedLang, setSelectedLang] = useState("DE");

  const languages = {
    DE: "Deutsch",
    TR: "Türkisch",
    FR: "Französisch",
    KU: "Kurdisch",
  };

  useEffect(() => {
    (async () => {
      const savedLang = await AsyncStorage.getItem("preferred_language");
      if (savedLang) setSelectedLang(savedLang);
    })();
  }, []);

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang);
    await AsyncStorage.setItem("preferred_language", lang);
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("iptv_session");
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>⚙️ Einstellungen</Text>

      <Text style={styles.subHeader}>Empfehlungssprache</Text>

      <View style={styles.langContainer}>
        {Object.entries(languages).map(([code, label]) => (
          <TouchableOpacity
            key={code}
            onPress={() => handleLanguageChange(code)}
            style={[
              styles.langButton,
              selectedLang === code && styles.langButtonActive,
            ]}
          >
            <Text
              style={[
                styles.langText,
                selectedLang === code && styles.langTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Abmelden</Text>
      </TouchableOpacity>

      <Text style={styles.info}>
        Nach dem Abmelden kannst du dich erneut mit deinen Xtream- oder
        M3U-Daten verbinden.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: Platform.OS === "ios" ? 80 : 60,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  header: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 30,
  },
  subHeader: {
    color: "#ff5722",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
  },
  langContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 40,
  },
  langButton: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 5,
  },
  langButtonActive: {
    backgroundColor: "#ff5722",
    borderColor: "#ff5722",
  },
  langText: {
    color: "#ccc",
    fontWeight: "600",
  },
  langTextActive: {
    color: "#fff",
  },
  logoutButton: {
    backgroundColor: "#ff5722",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 20,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    color: "#aaa",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
});