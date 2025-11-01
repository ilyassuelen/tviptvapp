import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "IPTV App",
  slug: "iptv-app",
  version: "1.0.0",
  orientation: "landscape",
  icon: "./assets/logo.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  android: {
    package: "com.ilyassulen.iptvapp",
    versionCode: 1,
    usesCleartextTraffic: true,
    minSdkVersion: 26,
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
    permissions: ["INTERNET", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE"],
  },
  ios: {
  bundleIdentifier: "com.ilyassulen.iptvapp",
  },
  plugins: ["expo-font", "expo-video", "expo-audio", "expo-asset"],
  extra: {
    eas: {
      projectId: "9c6f76b7-adfd-4dcb-9081-2a817c6ad221"
    }
  },
};

export default config;