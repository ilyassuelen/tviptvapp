import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState("DE");

  const languages = {
    DE: "Deutsch",
    TR: "Türkisch",
    FR: "Französisch",
    KU: "Kurdisch",
  };

  useEffect(() => {
    (async () => {
      const storedAccounts = await AsyncStorage.getItem("iptv_accounts");
      const activeIdx = await AsyncStorage.getItem("active_account_index");
      const lang = await AsyncStorage.getItem("preferred_language");
      if (storedAccounts) setAccounts(JSON.parse(storedAccounts));
      if (activeIdx !== null) setActiveIndex(parseInt(activeIdx, 10));
      if (lang) setSelectedLang(lang);
    })();
  }, []);

  const handleActivateAccount = async (index: number) => {
    try {
      await AsyncStorage.setItem("active_account_index", String(index));
      setActiveIndex(index);
      Alert.alert("✅ Account gewechselt", `${accounts[index].title} ist jetzt aktiv.`);
      // Navigation erzwingen, damit die App-Daten neu geladen werden
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err) {
      console.error("❌ Fehler beim Aktivieren des Accounts:", err);
    }
  };

  const handleAddAccount = async () => {
    navigation.navigate("Login"); // führt zum LoginScreen, um neuen Account anzulegen
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove([
      "iptv_session",
      "active_account_index",
      "daily_recommendations",
    ]);
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const handleLanguageChange = async (lang: string) => {
    setSelectedLang(lang);
    await AsyncStorage.setItem("preferred_language", lang);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ alignItems: "center", paddingBottom: 80 }}
    >
      <Text style={styles.header}>⚙️ Einstellungen</Text>

      {/* 👤 Mehrere Accounts anzeigen */}
      <View style={styles.profileContainer}>
        {accounts.map((acc, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.accountIcon,
              activeIndex === i && styles.activeAccount,
            ]}
            onPress={() => handleActivateAccount(i)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={28} color="#fff" />
            <Text style={styles.accountLabel} numberOfLines={1}>
              {acc.title || `Account ${i + 1}`}
            </Text>
            {activeIndex === i && (
              <Text style={styles.activeText}>Aktiv</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* ➕ Account hinzufügen */}
        <TouchableOpacity
          style={styles.addAccountIcon}
          onPress={handleAddAccount}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={30} color="#fff" />
          <Text style={styles.accountLabel}>Account hinzufügen</Text>
        </TouchableOpacity>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: Platform.OS === "ios" ? 70 : 50,
  },
  header: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 30,
  },
  profileContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    marginBottom: 40,
  },
  accountIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 5,
    position: "relative",
  },
  activeAccount: {
    borderColor: "#E50914",
    borderWidth: 2,
  },
  addAccountIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E50914",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 5,
  },
  accountLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    position: "absolute",
    bottom: -22,
    width: "100%",
  },
  activeText: {
    position: "absolute",
    bottom: -38,
    color: "#E50914",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  subHeader: {
    color: "#E50914",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    textAlign: "center",
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
    backgroundColor: "#E50914",
    borderColor: "#E50914",
  },
  langText: {
    color: "#ccc",
    fontWeight: "600",
  },
  langTextActive: {
    color: "#fff",
  },
  logoutButton: {
    backgroundColor: "#E50914",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: "center",
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  info: {
    color: "#aaa",
    fontSize: 13,
    textAlign: "center",
    marginHorizontal: 20,
  },
});