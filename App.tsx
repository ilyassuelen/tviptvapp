import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 📺 Screens
import HomeScreen from "./src/screens/HomeScreen";
import LiveScreen from "./src/screens/LiveScreen";
import MoviesScreen from "./src/screens/MoviesScreen";
import SeriesScreen from "./src/screens/SeriesScreen";
import FavoritesScreen from "./src/screens/FavoritesScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import SearchScreen from "./src/screens/SearchScreen";
import LoginScreen from "./src/screens/LoginScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import CategoryMoviesScreen from "./src/screens/CategoryMoviesScreen";
import CategorySeriesScreen from "./src/screens/CategorySeriesScreen";
import MovieDetailScreen from "./src/screens/MovieDetailScreen";
import SeriesDetailScreen from "./src/screens/SeriesDetailScreen";
import TrailerScreen from "./src/screens/TrailerScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,

        // 🔧 Hier Tab-Bar angepasst
        tabBarStyle: {
          backgroundColor: "#000", // kräftiges Schwarz
          borderTopWidth: 0, // keine Trennlinie oben
          height: 70,
        },
        tabBarActiveTintColor: "#fff", // aktive Icons weiß
        tabBarInactiveTintColor: "#888", // inaktive leicht grau
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          paddingBottom: 4,
        },

        // 🎨 Icons für jede Route
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home-outline",
            Live: "tv-outline",
            Movies: "film-outline",
            Series: "albums-outline",
            Favorites: "heart-outline",
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen name="Movies" component={MoviesScreen} />
      <Tab.Screen name="Series" component={SeriesScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState<"Login" | "MainTabs">("Login");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("iptv_session");
      setInitialRoute(saved ? "MainTabs" : "Login");
    })();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
        }}
        initialRouteName={initialRoute}
      >
        {/* 🔐 Login + Tabs */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* ⚙️ Weitere Screens */}
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="CategoryMovies" component={CategoryMoviesScreen} />
        <Stack.Screen name="CategorySeries" component={CategorySeriesScreen} />

        {/* 🎬 Film-Details */}
        <Stack.Screen
          name="MovieDetail"
          component={MovieDetailScreen}
          options={{
            headerShown: false,
            presentation: "transparentModal",
            cardStyle: { backgroundColor: "transparent" },
            animation: "fade",
          }}
        />

        {/* 📺 Serien-Details */}
        <Stack.Screen
          name="SeriesDetail"
          component={SeriesDetailScreen}
          options={{
            headerShown: false,
            presentation: "transparentModal",
            cardStyle: { backgroundColor: "transparent" },
            animation: "fade",
          }}
        />

        {/* 🎞️ Trailer-Vollbild */}
        <Stack.Screen
          name="Trailer"
          component={TrailerScreen}
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "fade",
            cardStyle: { backgroundColor: "black" },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}