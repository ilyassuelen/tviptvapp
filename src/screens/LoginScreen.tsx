import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { connectM3U, connectXtream } from "../api";
import { setPlaylist } from "../store";

export default function LoginScreen({ navigation }: any) {
  const [mode, setMode] = useState<"m3u" | "xtream">("m3u");
  const [m3u, setM3u] = useState("");
  const [url, setUrl] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const connect = async () => {
    try {
      if (mode === "m3u") {
        await connectM3U(m3u);
        setPlaylist("M3U");
      } else {
        await connectXtream(url, user, pass);
        setPlaylist("Xtream");
      }
      navigation.replace("MainTabs");
    } catch (err) {
      Alert.alert("Fehler", "Verbindung fehlgeschlagen. Bitte prüfen Sie die Daten.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20, backgroundColor: "#000" }}>
      <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 20 }}>IPTV Login</Text>

      <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 20 }}>
        <TouchableOpacity onPress={() => setMode("m3u")}><Text style={{ color: mode === "m3u" ? "#fff" : "#777", marginHorizontal: 10 }}>M3U</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setMode("xtream")}><Text style={{ color: mode === "xtream" ? "#fff" : "#777", marginHorizontal: 10 }}>Xtream Codes</Text></TouchableOpacity>
      </View>

      {mode === "m3u" ? (
        <>
          <TextInput placeholder="M3U Link" value={m3u} onChangeText={setM3u} style={inputStyle} placeholderTextColor="#888" />
        </>
      ) : (
        <>
          <TextInput placeholder="Server URL" value={url} onChangeText={setUrl} style={inputStyle} placeholderTextColor="#888" />
          <TextInput placeholder="Benutzername" value={user} onChangeText={setUser} style={inputStyle} placeholderTextColor="#888" />
          <TextInput placeholder="Passwort" value={pass} onChangeText={setPass} style={inputStyle} placeholderTextColor="#888" secureTextEntry />
        </>
      )}

      <TouchableOpacity onPress={connect} style={{ backgroundColor: "#ff5722", padding: 14, borderRadius: 8, marginTop: 10 }}>
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>Verbinden</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const inputStyle = {
  backgroundColor: "#111",
  color: "#fff",
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};