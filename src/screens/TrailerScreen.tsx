import React from "react";
import { SafeAreaView, View, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function TrailerScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { videoId } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <View style={{ flex: 1 }}>
        {/* 🔙 Zurück */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: "absolute",
            top: Platform.OS === "ios" ? 20 : 30,
            left: 20,
            zIndex: 10,
            backgroundColor: "rgba(0,0,0,0.4)",
            borderRadius: 20,
            padding: 6,
          }}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>

        {/* ▶️ YouTube Player */}
        <YoutubePlayer
          height={"100%"}
          width={"100%"}
          play={true}
          videoId={videoId}
        />
      </View>
    </SafeAreaView>
  );
}