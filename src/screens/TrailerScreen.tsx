import React from "react";
import { View, ActivityIndicator, Platform, StatusBar } from "react-native";
import { useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";

export default function TrailerScreen() {
  const route = useRoute<any>();
  const { url } = route.params || {};
  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingTop: Platform.OS === "ios" ? 40 : StatusBar.currentHeight }}>
      {url ? (
        <WebView
          source={{ uri: url }}
          startInLoadingState
          renderLoading={() => (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#ff5722" />
            </View>
          )}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#ff5722" />
        </View>
      )}
    </View>
  );
}