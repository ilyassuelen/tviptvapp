import * as ScreenOrientation from "expo-screen-orientation";
import KeyEvent from "react-native-keyevent";
import React, { useEffect, useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, View, TouchableOpacity, Text, Animated } from "react-native";
import { NavigationContainer, useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MoviesScreen from "./src/screens/MoviesScreen";
import SeriesScreen from "./src/screens/SeriesScreen";
import LiveScreen from "./src/screens/LiveScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SearchScreen from "./src/screens/SearchScreen";
import MovieDetailScreen from "./src/screens/MovieDetailScreen";
import SeriesDetailScreen from "./src/screens/SeriesDetailScreen";
import CategoryMoviesScreen from "./src/screens/CategoryMoviesScreen";
import CategorySeriesScreen from "./src/screens/CategorySeriesScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import TrailerScreen from "./src/screens/TrailerScreen";

const Stack = createNativeStackNavigator();

const navigationRef = React.createRef();

function SidebarLayout() {
  const navigation = useNavigation();
  const menuItems = [
    { name: "Home", icon: "home" },
    { name: "Live", icon: "tv-outline" },
    { name: "Movies", icon: "film-outline" },
    { name: "Series", icon: "albums-outline" },
    { name: "Favorites", icon: "star-outline" },
    { name: "Settings", icon: "settings-outline" },
  ];

  const [activeScreen, setActiveScreen] = useState("Home");
  const scaleAnimations = useRef(menuItems.map(() => new Animated.Value(1))).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Animate scale for active menu item
  const animateScale = useCallback((indexToAnimate) => {
    scaleAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: index === indexToAnimate ? 1.2 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [scaleAnimations]);

  // Animate fade for screen content
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeScreen, fadeAnim]);

  // Animate scale on activeScreen change
  useEffect(() => {
    const index = menuItems.findIndex(item => item.name === activeScreen);
    animateScale(index);
  }, [activeScreen, animateScale, menuItems]);

  // Expose setActiveScreen for global DPAD handler
  SidebarLayout.setActiveScreen = setActiveScreen;
  SidebarLayout.menuItems = menuItems;

  const renderScreen = () => {
    let content = null;
    switch (activeScreen) {
      case "Home": content = <HomeScreen />; break;
      case "Live": content = <LiveScreen />; break;
      case "Movies": content = <MoviesScreen />; break;
      case "Series": content = <SeriesScreen />; break;
      case "Favorites": content = <FavoritesScreen />; break;
      case "Settings": content = <SettingsScreen />; break;
      default: content = <HomeScreen />; break;
    }
    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {content}
      </Animated.View>
    );
  };

  return (
    <View style={{ flexDirection: "row", flex: 1, backgroundColor: "#000" }}>
      {/* Sidebar */}
      <View style={{
        width: 100,
        backgroundColor: "#111",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 20,
      }}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.name}
            onPress={() => setActiveScreen(item.name)}
            style={{
              alignItems: "center",
              marginVertical: 14,
              opacity: activeScreen === item.name ? 1 : 0.5,
            }}
            hasTVPreferredFocus={activeScreen === item.name}
          >
            <Animated.View style={{ transform: [{ scale: scaleAnimations[index] }] }}>
              <Ionicons
                name={item.icon}
                size={28}
                color={activeScreen === item.name ? "#E50914" : "#aaa"}
              />
              <Text
                style={{
                  color: activeScreen === item.name ? "#E50914" : "#aaa",
                  fontSize: 12,
                  marginTop: 6,
                  textAlign: "center",
                }}
              >
                {item.name}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        {renderScreen()}
      </View>
    </View>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<"Login" | "SidebarLayout" | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Erzwingt Landscape-Modus
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  // Globaler TV-Remote-/DPAD-Handler
  useEffect(() => {
    try {
      KeyEvent.onKeyDownListener((keyEvent) => {
        console.log("📺 TV-Key pressed:", keyEvent.keyCode);
        switch (keyEvent.keyCode) {
          case 19: // DPAD_UP
            {
              console.log("↑ UP");
              if (initialRoute === "SidebarLayout" && SidebarLayout.menuItems && SidebarLayout.setActiveScreen) {
                const currentIndex = SidebarLayout.menuItems.findIndex(item => item.name === SidebarLayout._activeScreen);
                const newIndex = currentIndex > 0 ? currentIndex - 1 : SidebarLayout.menuItems.length - 1;
                SidebarLayout.setActiveScreen(SidebarLayout.menuItems[newIndex].name);
                SidebarLayout._activeScreen = SidebarLayout.menuItems[newIndex].name;
              }
            }
            break;
          case 20: // DPAD_DOWN
            {
              console.log("↓ DOWN");
              if (initialRoute === "SidebarLayout" && SidebarLayout.menuItems && SidebarLayout.setActiveScreen) {
                const currentIndex = SidebarLayout.menuItems.findIndex(item => item.name === SidebarLayout._activeScreen);
                const newIndex = currentIndex < SidebarLayout.menuItems.length - 1 ? currentIndex + 1 : 0;
                SidebarLayout.setActiveScreen(SidebarLayout.menuItems[newIndex].name);
                SidebarLayout._activeScreen = SidebarLayout.menuItems[newIndex].name;
              }
            }
            break;
          case 21: // DPAD_LEFT
            console.log("← LEFT");
            break;
          case 22: // DPAD_RIGHT
            console.log("→ RIGHT");
            break;
          case 23: // DPAD_CENTER / OK
            console.log("✅ OK pressed");
            if (initialRoute === "SidebarLayout" && SidebarLayout._activeScreen) {
              SidebarLayout.setActiveScreen(SidebarLayout._activeScreen);
            }
            break;
          case 4: // BACK
            console.log("↩️ BACK pressed");
            if (navigationRef.current) {
              const routes = navigationRef.current.getRootState()?.routes;
              const currentRoute = routes && routes[routes.length - 1];
              if (currentRoute?.name === "Player") {
                navigationRef.current.goBack();
              } else {
                console.log("Back pressed outside Player screen");
              }
            }
            break;
          default:
            console.log("Other key:", keyEvent.keyCode);
        }
      });
    } catch (e) {
      console.warn("KeyEvent listener konnte nicht initialisiert werden:", e);
    }

    return () => {
      try {
        KeyEvent.removeKeyDownListener();
      } catch (e) {}
    };
  }, [initialRoute]);

  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const activeIndex = await AsyncStorage.getItem("active_account_index");
        const accountsRaw = await AsyncStorage.getItem("iptv_accounts");

        if (activeIndex !== null && accountsRaw) {
          const accounts = JSON.parse(accountsRaw);
          const active = accounts[parseInt(activeIndex, 10)];
          if (active) {
            await AsyncStorage.setItem("iptv_session", JSON.stringify(active));
            setInitialRoute("SidebarLayout");
            SidebarLayout._activeScreen = "Home";
            setCheckingSession(false);
            return;
          }
        }

        // Falls keine Session vorhanden
        setInitialRoute("Login");
      } catch (err) {
        console.error("❌ Fehler beim Laden der aktiven Session:", err);
        setInitialRoute("Login");
      } finally {
        setCheckingSession(false);
      }
    };

    checkActiveSession();
  }, []);

  // ⏳ Zeige nichts, bis die Session-Prüfung abgeschlossen ist
  if (checkingSession || initialRoute === null) {
    return null; // alternativ: Lade-Spinner einbauen
  }

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false, animation: "fade" }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SidebarLayout" component={SidebarLayout} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
          <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
          <Stack.Screen name="CategoryMovies" component={CategoryMoviesScreen} />
          <Stack.Screen name="CategorySeries" component={CategorySeriesScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="Trailer" component={TrailerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}