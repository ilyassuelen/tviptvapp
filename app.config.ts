import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "IPTV App",
  slug: "iptv-app",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/logo.png",
  userInterfaceStyle: "dark",
  splash: {
    image: "./assets/logo.png",
    resizeMode: "contain",
    backgroundColor: "#000000",
  },

  ios: {
    supportsTablet: true,

    // ➕ Erlaubt beide Orientierungen vollständig
    orientations: ["portrait", "landscape-right", "landscape-left"],

    bundleIdentifier: "com.ilyassulen.iptvapp",

    infoPlist: {
      UISupportedInterfaceOrientations: [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],

      // 🔓 erlaubt unsichere HTTP-Verbindungen
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          "m3u.best-smarter.me": {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: "TLSv1.0",
          },
          "87.106.10.34": {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
          },
          "192.168.2.101": {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },

  android: {
    package: "com.ilyassulen.iptvapp",
    // ⚙️ erlaubt HTTP auf Android
    usesCleartextTraffic: true,
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
  },

  web: {
    favicon: "./assets/logo.png",
  },

  plugins: ["expo-font", "expo-video", "expo-audio"],
};

export default config;