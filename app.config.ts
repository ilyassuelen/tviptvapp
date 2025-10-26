import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "IPTV App",
  slug: "iptv-app",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/logo.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
  },
  web: {
    favicon: "./assets/logo.png",
  },
  plugins: [
    "expo-font", // 🔹 notwendig, damit expo-font korrekt funktioniert
  ],
};

export default config;