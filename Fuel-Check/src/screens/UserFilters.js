import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import Slider from '@react-native-community/slider';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const FUEL_TYPES = ["Petrol 92 octane", "Petrol 95 octane", "Auto Diesel", "Super Diesel", "Kerosene"];

export default function UserFilters({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedFuel, setSelectedFuel] = useState("");
  const [maxQueue, setMaxQueue] = useState(20);

  useEffect(() => {
    fetchFiltersFromDB();
  }, []);

  const fetchFiltersFromDB = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('user_filters')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setSelectedFuel(data.selected_fuel || "");
        setMaxQueue(data.max_queue || 20);
      }
    } catch (e) {
      console.log("No filters found, using local defaults.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('user_filters').upsert({
        user_id: user.id,
        selected_fuel: selectedFuel,
        max_queue: Math.round(maxQueue),
        updated_at: new Date()
      });
      if (error) throw error;
      Alert.alert("Success", "Filters applied!");
      navigation.navigate('UserHome');
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('user_filters').upsert({
        user_id: user.id,
        selected_fuel: "",
        max_queue: 20,
        updated_at: new Date()
      });
      if (error) throw error;
      setSelectedFuel("");
      setMaxQueue(20);
      Alert.alert("Reset", "Filters set to default.");
    } catch (error) {
      Alert.alert("Reset Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FFB800" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <TouchableOpacity style={styles.profileCircle}><Ionicons name="person" size={24} color="black" /></TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Filters</Text>

        {/* Fuel Type Grid */}
        <View style={styles.fuelContainer}>
          <View style={styles.fuelLabelBox}><Text style={styles.sideLabel}>Fuel Type</Text></View>
          <View style={styles.fuelGrid}>
            {FUEL_TYPES.map(type => (
              <TouchableOpacity 
                key={type} 
                style={[styles.fuelBtn, selectedFuel === type && styles.activeFuel]} 
                onPress={() => setSelectedFuel(selectedFuel === type ? "" : type)}
              >
                <Text style={styles.fuelBtnText}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Queue Slider Only */}
        <Text style={styles.label}>Maximum Que Length: {maxQueue} vehicles</Text>
        <View style={styles.sliderTrackWrap}>
          <View style={styles.sliderTrackBase} />
          <View style={[styles.sliderTrackFill, { width: `${(maxQueue / 50) * 100}%` }]} />
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={50}
            step={1}
            value={maxQueue}
            onValueChange={setMaxQueue}
            minimumTrackTintColor="transparent"
            maximumTrackTintColor="transparent"
            thumbTintColor="#FFB800"
          />
        </View>
        <View style={styles.sliderLabels}>
            <Text style={styles.subText}>0 vehicles</Text>
            <Text style={styles.subText}>50+ vehicles</Text>
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply} disabled={saving}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>Apply Filters</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={resetFilters} disabled={saving}>
            <Text style={styles.btnText}>Reset Filters</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFB800', height: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40 },
  headerTitle: { fontSize: 26, fontWeight: 'bold' },
  profileCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  sectionTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 25 },
  fuelContainer: { flexDirection: 'row', backgroundColor: '#FFB800', borderRadius: 15, overflow: 'hidden', marginBottom: 25 },
  fuelLabelBox: { backgroundColor: '#222', width: 90, justifyContent: 'center', alignItems: 'center' },
  sideLabel: { color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  fuelGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
  fuelBtn: { backgroundColor: '#FFE082', padding: 10, borderRadius: 8, marginBottom: 8, width: '48%' },
  activeFuel: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#000' },
  fuelBtnText: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  label: { fontWeight: 'bold', fontSize: 18, marginTop: 20 },
  sliderTrackWrap: { width: '100%', justifyContent: 'center', marginTop: 6 },
  sliderTrackBase: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: '#D8D8D8' },
  sliderTrackFill: { position: 'absolute', left: 0, height: 8, borderRadius: 4, backgroundColor: '#FFB800' },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 },
  subText: { fontSize: 15, color: '#888' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, marginBottom: 60 },
  applyBtn: { backgroundColor: '#FFB800', width: '47%', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 3 },
  resetBtn: { backgroundColor: '#FFB800', width: '47%', padding: 18, borderRadius: 12, alignItems: 'center', elevation: 3 },
  btnText: { fontWeight: 'bold', fontSize: 16 }
});