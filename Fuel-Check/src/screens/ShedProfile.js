import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '../../lib/supabase'; // Verify this path: ../lib/ or ../../lib/
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function ShedProfile({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [shed, setShed] = useState(null);

  useEffect(() => {
    fetchShedData();
  }, []);

  const fetchShedData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('sheds')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setShed(data);
    } catch (error) {
      console.error("Error fetching profile:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      navigation.replace('LoginPage');
    } else {
      Alert.alert("Logout Failed", error.message);
    }
  };

  // Leaflet HTML Template
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
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          dragging: false,
          touchZoom: false,
          scrollWheelZoom: false
        }).setView([${shed?.latitude || 6.9271}, ${shed?.longitude || 79.8612}], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OSM'
        }).addTo(map);

        L.marker([${shed?.latitude || 6.9271}, ${shed?.longitude || 79.8612}]).addTo(map);
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="black" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Station Information</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Station Name</Text><Text style={styles.infoValue}>{shed?.station_name || 'N/A'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Owner Name</Text><Text style={styles.infoValue}>{shed?.owner_name || 'N/A'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Contact</Text><Text style={styles.infoValue}>{shed?.contact_no || 'N/A'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue}>{shed?.email || 'N/A'}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{shed?.address || 'N/A'}</Text></View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: shed?.is_verified ? '#4CAF50' : '#FF3B30' }]}>
              <Text style={styles.statusText}>{shed?.is_verified ? 'Verified' : 'Pending'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Location Information</Text>

        {/* Leaflet WebView Map */}
        <View style={styles.mapCard}>
          <WebView 
            originWhitelist={['*']}
            source={{ html: mapHTML }}
            style={styles.map}
            scrollEnabled={false}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFB800', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  content: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15 },
  infoCard: { backgroundColor: '#FFD966', borderRadius: 15, padding: 20, elevation: 2 },
  infoRow: { flexDirection: 'row', marginBottom: 12, justifyContent: 'space-between' },
  infoLabel: { fontWeight: 'bold', width: '40%', fontSize: 13 },
  infoValue: { flex: 1, color: '#333', fontSize: 13, textAlign: 'right' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  mapCard: { height: 250, width: '100%', borderRadius: 15, overflow: 'hidden', marginBottom: 40, borderWidth: 1, borderColor: '#DDD' },
  map: { flex: 1, backgroundColor: '#EEE' }
});