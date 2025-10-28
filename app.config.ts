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
    bundleIdentifier: "com.ilyassulen.iptvapp",
  },
  android: {
    package: "com.ilyassulen.iptvapp",
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
  },
  scheme: "iptvapp",
  web: {
    favicon: "./assets/logo.png",
  },
  plugins: ["expo-font"],
};

export default config;