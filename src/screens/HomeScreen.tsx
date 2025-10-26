import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ScrollView, Alert } from "react-native";
import Header from "../components/Header";
import PosterCard from "../components/PosterCard";
import { appState } from "../store";
import { fetchTrending } from "../api";

export default function HomeScreen({ navigation }: any) {
  const [movies, setMovies] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);

  useEffect(() => {
    if (!appState.playlist) return;
    fetchTrending(appState.playlist)
      .then(d => { setMovies(d.movies); setSeries(d.series); })
      .catch(() => Alert.alert("Fehler", "Daten konnten nicht geladen werden."));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Header onSearch={() => navigation.navigate("Search")} onSettings={() => navigation.navigate("Settings")} />
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <Text style={sectionTitle}>Top 20 trendende Filme</Text>
        <FlatList data={movies} horizontal keyExtractor={i => i.id} renderItem={({ item }) => <PosterCard item={item} onPress={() => {}} />} />
        <Text style={sectionTitle}>Top 20 trendende Serien</Text>
        <FlatList data={series} horizontal keyExtractor={i => i.id} renderItem={({ item }) => <PosterCard item={item} onPress={() => {}} />} />
      </ScrollView>
    </View>
  );
}

const sectionTitle = { color: "#fff", fontSize: 18, fontWeight: "600", marginVertical: 10 };