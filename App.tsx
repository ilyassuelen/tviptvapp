import React from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

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
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#000000",
          borderTopColor: "rgba(255,255,255,0.08)",
          paddingTop: Platform.OS === "ios" ? 6 : 0,
          height: Platform.OS === "ios" ? 88 : 60,
        },
        tabBarActiveTintColor: "#E50914", // 🔴 Netflix-Rot
        tabBarInactiveTintColor: "#9A9A9A",
        tabBarActiveBackgroundColor: "rgba(229,9,20,0.06)", // dezenter Glow beim aktiven Tab
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home",
            Live: "tv-outline",
            Movies: "film-outline",
            Series: "albums-outline",
            Favorites: "star-outline",
            Settings: "settings-outline",
          };
          const name = map[route.name] ?? "ellipse-outline";
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginBottom: Platform.OS === "ios" ? 2 : 4,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen name="Movies" component={MoviesScreen} />
      <Tab.Screen name="Series" component={SeriesScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
        <Stack.Screen name="SeriesDetail" component={SeriesDetailScreen} />
        <Stack.Screen name="CategoryMovies" component={CategoryMoviesScreen} />
        <Stack.Screen name="CategorySeries" component={CategorySeriesScreen} />
        <Stack.Screen name="Player" component={PlayerScreen} />
        <Stack.Screen name="Trailer" component={TrailerScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}