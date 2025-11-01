import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Alert,
  Modal,
  Animated,
  Easing,
  FlatList,
  TVEventHandler,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

function useTVNavigation(actions: Array<() => void>) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tvEventHandler = useRef<TVEventHandler | null>(null);

  useEffect(() => {
    tvEventHandler.current = new TVEventHandler();
    tvEventHandler.current.enable(null, (cmp, evt) => {
      if (!evt || !evt.eventType) return;
      if (evt.eventType === "right") setFocusedIndex((prev) => Math.min(prev + 1, actions.length - 1));
      if (evt.eventType === "left") setFocusedIndex((prev) => Math.max(prev - 1, 0));
      if (evt.eventType === "down") setFocusedIndex((prev) => Math.min(prev + 1, actions.length - 1));
      if (evt.eventType === "up") setFocusedIndex((prev) => Math.max(prev - 1, 0));
      if (evt.eventType === "select") actions[focusedIndex]?.();
    });
    return () => tvEventHandler.current?.disable();
  }, [focusedIndex, actions]);

  return focusedIndex;
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState("DE");

  const [editModalVisible, setEditModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const buttonActions = [
    ...accounts.map((_, i) => () => handleSelectAccount(i)),
    handleAddAccount,
    handleLogout,
  ];
  const focusedIndex = useTVNavigation(buttonActions);

  const openEditModal = () => {
    setEditModalVisible(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeEditModal = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setEditModalVisible(false));
  };

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

  // Account-Wechsel-Logik: Session & Index speichern und Navigation resetten
  const handleSelectAccount = async (index: number) => {
    try {
      const accountsRaw = await AsyncStorage.getItem("iptv_accounts");
      if (!accountsRaw) return;
      const accounts = JSON.parse(accountsRaw);
      const selected = accounts[index];
      if (!selected) return;

      // Speichere aktive Session & Index
      await AsyncStorage.setItem("iptv_session", JSON.stringify(selected));
      await AsyncStorage.setItem("active_account_index", index.toString());

      // Navigation Reset → alle Screens neu laden mit dem neuen Account
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" }],
      });
    } catch (err) {
      console.error("❌ Fehler beim Wechseln des Accounts:", err);
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

  // Delete confirmation and logic
  const confirmDelete = (index: number) => {
    Alert.alert(
      "Account entfernen",
      `Möchtest du diesen Account wirklich entfernen?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: () => deleteAccount(index),
        },
      ]
    );
  };
  const deleteAccount = async (index: number) => {
    try {
      const updatedAccounts = [...accounts];
      updatedAccounts.splice(index, 1);
      setAccounts(updatedAccounts);
      await AsyncStorage.setItem("iptv_accounts", JSON.stringify(updatedAccounts));
      // Wenn der aktive Account entfernt wurde:
      if (activeIndex === index) {
        if (updatedAccounts.length > 0) {
          setActiveIndex(0);
          await AsyncStorage.setItem("active_account_index", "0");
          navigation.reset({
            index: 0,
            routes: [{ name: "MainTabs" }],
          });
        } else {
          setActiveIndex(null);
          await AsyncStorage.removeItem("active_account_index");
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }
      } else if (activeIndex !== null && activeIndex > index) {
        // Wenn ein früherer Account gelöscht wurde, Index anpassen
        setActiveIndex(activeIndex - 1);
        await AsyncStorage.setItem("active_account_index", String(activeIndex - 1));
      }
    } catch (err) {
      console.error("❌ Fehler beim Löschen des Accounts:", err);
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ alignItems: "center", paddingBottom: 80 }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, width: "90%", alignSelf: "center" }}>
          <Text style={styles.sectionTitle ? styles.sectionTitle : styles.header}>Einstellungen</Text>
          <TouchableOpacity onPress={openEditModal}>
            <Text style={{ color: "#E50914", fontSize: 15, fontWeight: "700" }}>Bearbeiten</Text>
          </TouchableOpacity>
        </View>

        {/* 👤 Mehrere Accounts anzeigen */}
        <View style={styles.profileContainer}>
          {accounts.map((acc, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.accountIcon,
                activeIndex === i && styles.activeAccount,
                focusedIndex === i && { borderColor: "#E50914", borderWidth: 3 },
              ]}
              onPress={() => handleSelectAccount(i)}
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
            style={[
              styles.addAccountIcon,
              focusedIndex === accounts.length && { borderWidth: 3, borderColor: "#E50914" },
            ]}
            onPress={handleAddAccount}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={30} color="#fff" />
            <Text style={[styles.accountLabel, { marginTop: 14 }]}>Account hinzufügen</Text>
          </TouchableOpacity>
        </View>

        {/* Abstand zwischen Profil-Icons und Empfehlungssprache */}
        <View style={{ height: 30 }} />

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

        <TouchableOpacity
          style={[
            styles.logoutButton,
            focusedIndex === accounts.length + 1 && { borderWidth: 3, borderColor: "#fff" },
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>

        <Text style={styles.info}>
          Nach dem Abmelden kannst du dich erneut mit deinen Xtream- oder
          M3U-Daten verbinden.
        </Text>
      </ScrollView>
      <Modal transparent visible={editModalVisible} animationType="none">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          activeOpacity={1}
          onPress={closeEditModal}
        />
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "50%",
            backgroundColor: "#111",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              },
            ],
            padding: 20,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Profile bearbeiten</Text>
            <TouchableOpacity onPress={closeEditModal}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={accounts}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomColor: "rgba(255,255,255,0.1)",
                  borderBottomWidth: 1,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => handleSelectAccount(index)}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: "#222",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="person-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={{ color: "#fff", fontSize: 15 }}>{item.title || `Account ${index + 1}`}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => confirmDelete(index)}
                    style={{
                      backgroundColor: "#E50914",
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Account entfernen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </Animated.View>
      </Modal>
    </>
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
  sectionTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
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