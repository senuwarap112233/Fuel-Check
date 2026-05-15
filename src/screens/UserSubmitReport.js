import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const FUEL_TYPES = ["Petrol 92 octane", "Petrol 95 octane", "Auto Diesel", "Super Diesel", "Kerosene"];
const STOCK_LEVELS = [
  { label: 'Available', color: '#32D74B' },
  { label: 'Limited Stock', color: '#FF9500' },
  { label: 'Out of Stock', color: '#FF3B30' }
];
const VEHICLES = [
  { id: 'bike', icon: 'motorbike' },
  { id: 'car', icon: 'car' },
  { id: 'tuk', icon: 'rickshaw' },
  { id: 'truck', icon: 'truck' }
];
const QUEUES = ["0-15", "16-30", "31-45", "45+"];

export default function UserSubmitReport() {
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  
  const [allSheds, setAllSheds] = useState([]);
  const [location, setLocation] = useState(null);
  const [selectedShed, setSelectedShed] = useState(null);
  
  // Form States
  const [fuelType, setFuelType] = useState(FUEL_TYPES[0]);
  const [stockLevel, setStockLevel] = useState('Available');
  const [vehicle, setVehicle] = useState('bike');
  const [queue, setQueue] = useState('0-15');
  const [comment, setComment] = useState('');

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let userLoc = await Location.getCurrentPositionAsync({});
        setLocation(userLoc.coords);
      }
      const { data } = await supabase.from('sheds').select('id, station_name, latitude, longitude').eq('is_verified', true);
      if (data) setAllSheds(data);
      setPageLoading(false);
    })();
  }, []);

  const handleMapEvent = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'SHED_SELECTED') {
      setSelectedShed({ id: data.id, name: data.name });
    }
  };

  const clearForm = () => {
    setSelectedShed(null);
    setFuelType(FUEL_TYPES[0]);
    setStockLevel('Available');
    setVehicle('bike');
    setQueue('0-15');
    setComment('');
    // Optional: Reset map zoom
    if (mapRef.current && location) {
      mapRef.current.injectJavaScript(`map.setView([${location.latitude}, ${location.longitude}], 12);`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedShed) return Alert.alert("Wait!", "Please tap a station on the map first.");
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('community_reports').insert([{
        shed_id: selectedShed.id,
        user_id: user.id,
        fuel_type: fuelType,
        stock_level: stockLevel,
        vehicle_type: vehicle,
        queue_length: queue,
        comment: comment,
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;
      Alert.alert("Success", "Report submitted!");
      clearForm(); // Automatically clears after successful submit
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .locate-btn {
          position: absolute; top: 10px; right: 10px; z-index: 1000;
          background: white; border: 2px solid rgba(0,0,0,0.2);
          border-radius: 50%; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        /* Custom Green Label Styling */
        .green-label {
          background-color: #2E7D32;
          border: 1px solid #1B5E20;
          color: white;
          font-weight: bold;
          border-radius: 4px;
          padding: 2px 6px;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <button class="locate-btn" onclick="goHome()">📍</button>
      <script>
        var map = L.map('map', { zoomControl: true, dragging: true, touchZoom: true })
          .setView([${location?.latitude || 6.9271}, ${location?.longitude || 79.8612}], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        // Green Icon Definition
        var greenIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41], iconAnchor: [12, 41]
        });

        // --- THE FIX: Adding a Permanent Green Label ---
        var userMarker = L.marker([${location?.latitude || 6.9271}, ${location?.longitude || 79.8612}], {icon: greenIcon})
          .addTo(map)
          .bindTooltip("You are here", { 
            permanent: true, 
            direction: 'top', 
            className: 'green-label',
            offset: [0, -35] 
          });

        function goHome() { 
          map.flyTo([${location?.latitude}, ${location?.longitude}], 15); 
        }

        const sheds = ${JSON.stringify(allSheds)};
        sheds.forEach(shed => {
          L.marker([shed.latitude, shed.longitude]).addTo(map).on('click', function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SHED_SELECTED', id: shed.id, name: shed.station_name
            }));
          });
        });
      </script>
    </body>
    </html>
  `;

  if (pageLoading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#FFB800" /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <View style={styles.profileCircle}><Ionicons name="person" size={24} color="black" /></View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Submit Report</Text>
        
        <Text style={styles.label}>Select Fuel station from map</Text>
        <View style={styles.mapWrapper}>
          <WebView 
            ref={mapRef}
            source={{ html: mapHTML }} 
            onMessage={handleMapEvent} 
            scrollEnabled={true}
            nestedScrollEnabled={true}
          />
        </View>

        {selectedShed ? (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
            <Text style={styles.verifiedText}>Location verified: {selectedShed.name}</Text>
          </View>
        ) : (
          <Text style={{ color: '#888', fontSize: 11, marginTop: 5 }}>Map preview shown above this section</Text>
        )}

        <View style={styles.fuelContainer}>
          <View style={styles.sideLabelBox}><Text style={styles.sideLabel}>Fuel Type</Text></View>
          <View style={styles.fuelGrid}>
            {FUEL_TYPES.map(t => (
              <TouchableOpacity key={t} 
                style={[styles.fuelBtn, fuelType === t && styles.activeFuel]} 
                onPress={() => setFuelType(t)}>
                <Text style={styles.fuelBtnText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.label}>Minimum Stock Level</Text>
        <View style={styles.row}>
          {STOCK_LEVELS.map(s => (
            <TouchableOpacity key={s.label} 
              style={[styles.stockBtn, { backgroundColor: s.color }, stockLevel !== s.label && { opacity: 0.3 }]} 
              onPress={() => setStockLevel(s.label)}>
              <Text style={styles.btnText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Vehicle Type</Text>
        <View style={styles.radioRow}>
          {VEHICLES.map(v => (
            <TouchableOpacity key={v.id} style={styles.radioItem} onPress={() => setVehicle(v.id)}>
              <Ionicons name={vehicle === v.id ? "radio-button-on" : "radio-button-off"} size={22} color="black" />
              <MaterialCommunityIcons name={v.icon} size={28} color="black" style={{ marginLeft: 5 }} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Queue Length</Text>
        <Text style={{fontSize: 12, color: '#666', marginBottom: 10}}>How many vehicles are waiting?</Text>
        <View style={styles.queueGrid}>
          {QUEUES.map(q => (
            <TouchableOpacity key={q} style={styles.queueItem} onPress={() => setQueue(q)}>
              <Ionicons name={queue === q ? "radio-button-on" : "radio-button-off"} size={22} color="black" />
              <Text style={styles.queueLabel}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Add a comment</Text>
        <TextInput 
          style={styles.input} 
          multiline 
          placeholder="What's the situation?" 
          value={comment} 
          onChangeText={setComment} 
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.clearBtn} onPress={clearForm}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="black" /> : <Text style={styles.submitText}>Submit</Text>}
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
  sectionTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  label: { fontWeight: 'bold', fontSize: 16, marginTop: 25, marginBottom: 10 },
  mapWrapper: { height: 220, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#DDD' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  verifiedText: { color: '#2E7D32', fontWeight: '700', marginLeft: 5, fontSize: 15 },
  fuelContainer: { flexDirection: 'row', backgroundColor: '#FFB800', borderRadius: 15, marginTop: 20, overflow: 'hidden' },
  sideLabelBox: { backgroundColor: '#222', width: 90, justifyContent: 'center', alignItems: 'center' },
  sideLabel: { color: 'white', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  fuelGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
  fuelBtn: { backgroundColor: '#FFE082', padding: 10, borderRadius: 8, marginBottom: 8, width: '48%' },
  activeFuel: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#000' },
  fuelBtnText: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stockBtn: { flex: 1, padding: 12, borderRadius: 10, marginHorizontal: 4, alignItems: 'center' },
  btnText: { fontWeight: 'bold', fontSize: 17 },
  radioRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10 },
  radioItem: { flexDirection: 'row', alignItems: 'center' },
  queueGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  queueItem: { flexDirection: 'row', alignItems: 'center', width: '50%', marginBottom: 15 },
  queueLabel: { marginLeft: 10, fontSize: 16 },
  input: { backgroundColor: '#F9F9F9', borderRadius: 15, padding: 15, height: 100, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 80 },
  clearBtn: { width: '46%', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#FFB800', alignItems: 'center' },
  clearText: { color: '#FFB800', fontWeight: 'bold' },
  submitBtn: { width: '46%', padding: 15, borderRadius: 10, backgroundColor: '#FFB800', alignItems: 'center' },
  submitText: { fontWeight: 'bold' }
});