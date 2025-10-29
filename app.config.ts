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
    bundleIdentifier: "com.ilyassulen.iptvapp",
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsLocalNetworking: true,
        NSExceptionDomains: {
          "m3u.best-smarter.me": {
            NSIncludesSubdomains: true,
            NSTemporaryExceptionAllowsInsecureHTTPLoads: true,
            NSTemporaryExceptionMinimumTLSVersion: "TLSv1.0",
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
    adaptiveIcon: {
      foregroundImage: "./assets/logo.png",
      backgroundColor: "#000000",
    },
  },
  web: {
    favicon: "./assets/logo.png",
  },
  plugins: ["expo-font"],
};

export default config;