import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, ScrollView, 
  TouchableOpacity, RefreshControl, Alert 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

export default function UserHome({ navigation }) {
  const mapRef = useRef(null);
  const cachedLocation = useRef(null);
  const locationPermissionGranted = useRef(null);
  const pendingMapScriptRef = useRef('');
  const [location, setLocation] = useState(null);
  const [sheds, setSheds] = useState([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFuel, setActiveFuel] = useState("");
  const [queueLimit, setQueueLimit] = useState(20);
  const [selectedShedId, setSelectedShedId] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const markersData = useMemo(() => JSON.stringify(sheds), [sheds]);

  const mapHTML = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body { margin: 0; } #map { height: 100vh; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([7.87, 80.65], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        var markerGroup = L.layerGroup().addTo(map);

        window.updateMarkers = (sheds, uLat, uLon, selId) => {
          if (uLat == null || uLon == null) {
            return;
          }

          markerGroup.clearLayers();
          L.marker([uLat, uLon], {icon: L.icon({iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', iconSize: [25, 41]})}).addTo(markerGroup).bindPopup("<b>You are here</b>");

          sheds.forEach(s => {
            const isSel = s.id === selId;
            let color = 'gold';
            if (s.stockStatus === 'Out of Stock') color = 'red';
            else if (s.stockStatus === 'Stock Not Sure') color = 'orange';
            else if (s.stockStatus === 'No Data') color = 'grey';

            const marker = L.marker([s.latitude, s.longitude], {
              icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-' + color + '.png',
                iconSize: isSel ? [32, 48] : [25, 41]
              })
            }).addTo(markerGroup);
            
            marker.on('click', () => {
               window.ReactNativeWebView.postMessage(JSON.stringify({type: 'MARKER_CLICK', id: s.id}));
            });
          });
        };
      </script>
    </body>
    </html>
  `, []);

  const mapSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  const fetchData = useCallback(async ({ manualRefresh = false } = {}) => {
    if (manualRefresh) setRefreshing(true);
    try {
      let userCoords = cachedLocation.current;

      if (!userCoords) {
        if (locationPermissionGranted.current === null) {
          let { status } = await Location.requestForegroundPermissionsAsync();
          locationPermissionGranted.current = status === 'granted';
        }

        if (!locationPermissionGranted.current) {
          Alert.alert("Permission Denied", "Location is needed to find the nearest sheds.");
          return;
        }

        const lastKnownLocation = await Location.getLastKnownPositionAsync();

        if (lastKnownLocation?.coords) {
          userCoords = lastKnownLocation.coords;
        } else {
          let userLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          userCoords = userLoc.coords;
        }

        cachedLocation.current = userCoords;
        setLocation(userCoords);
      } else {
        setLocation(userCoords);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSheds([]);
        return;
      }

      const { data: filters } = await supabase
        .from('user_filters')
        .select('selected_fuel, max_queue')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const fuelFilter = filters?.selected_fuel || "";
      const qLimit = filters?.max_queue ?? 50;
      setActiveFuel(fuelFilter);
      setQueueLimit(qLimit);

      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { data: shedData, error } = await supabase
        .from('sheds')
        .select('id, station_name, latitude, longitude, fuel_stocks!fk_shed (fuel_type, stock_liters, price_rs), community_reports (queue_length, stock_level, fuel_type, created_at)')
        .eq('is_verified', true);

      if (error) throw error;

      const processed = (shedData || []).map(shed => {
        const fuelStocks = Array.isArray(shed.fuel_stocks) ? shed.fuel_stocks : [];
        const communityReports = Array.isArray(shed.community_reports) ? shed.community_reports : [];

        // Distance calculation
        const R = 6371;
        const dLat = (shed.latitude - userCoords.latitude) * Math.PI / 180;
        const dLon = (shed.longitude - userCoords.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(userCoords.latitude * Math.PI / 180) * Math.cos(shed.latitude * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const dist = parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));

        // Queue Calculation (Weighted)
        const recent = communityReports.filter(r => r.created_at > yesterday);
        const qMap = { "0-15": 7, "16-30": 23, "31-45": 38, "45+": 60 };
        const totalQ = recent.reduce((acc, r) => acc + (qMap[r.queue_length] || 0), 0);
        const avgQ = recent.length > 0 ? Math.round(totalQ / recent.length) : 0; 

        // Stock Status Logic
        let stockStatus = "No Data";
        let statusColor = "#F5F5F5"; 
        let textColor = "#757575";

        if (fuelFilter) {
          const fuelInfo = fuelStocks.find(f => f.fuel_type.trim().toLowerCase().includes(fuelFilter.toLowerCase().trim()));
          const outReports = recent.filter(r => r.stock_level === 'Out of Stock' && r.fuel_type === fuelFilter).length;

          if (fuelInfo) {
             if (fuelInfo.stock_liters <= 0 || outReports >= 10) {
                stockStatus = "Out of Stock"; statusColor = "#FFEBEE"; textColor = "red";
             } else if (outReports >= 1) {
                stockStatus = "Stock Not Sure"; statusColor = "#FFF3E0"; textColor = "#E65100";
             } else {
                stockStatus = "In Stock"; statusColor = "#E8F5E9"; textColor = "green";
             }
          }
        }

        return { ...shed, distance: dist, avgQ, reportCount: recent.length, stockStatus, statusColor, textColor };
      })
      .filter(s => {
        // Show the station even if fuel info is missing (FuelMatch logic removed for better visibility)
        const queueMatch = s.avgQ <= qLimit;
        return queueMatch;
      })
      .sort((a, b) => a.distance - b.distance);

      setSheds(processed);
      // Persist the single nearest shed for this user (backfill from client)
      try {
        if ((processed || []).length > 0) {
          const nearestId = processed[0].id;
          // get current profile nearest_shed_id to avoid unnecessary writes
          const { data: profileData, error: profileErr } = await supabase
            .from('profiles')
            .select('nearest_shed_id')
            .eq('id', user.id)
            .maybeSingle();

          if (profileErr) throw profileErr;

          const currentNearest = profileData?.nearest_shed_id || null;
          if (!currentNearest || currentNearest !== nearestId) {
            await supabase
              .from('profiles')
              .update({ nearest_shed_id: nearestId, nearest_shed_updated_at: new Date().toISOString() })
              .eq('id', user.id);
          }
        }
      } catch (err) {
        console.warn('Failed to persist nearest_shed_id:', err.message || err);
      }
    } catch (e) { 
      console.error("Fetch Error:", e);
    } finally { 
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    fetchData();
  }, [fetchData]));

  useEffect(() => {
    if (!location) {
      return;
    }

    const jsCode = `updateMarkers(${markersData}, ${location.latitude}, ${location.longitude}, ${JSON.stringify(selectedShedId)});`;

    if (mapReady && mapRef.current) {
      mapRef.current.injectJavaScript(jsCode);
    } else {
      pendingMapScriptRef.current = jsCode;
    }
  }, [location, mapReady, markersData, selectedShedId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('UserAccount')}>
          <Ionicons name="person" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <View style={styles.mapWrapper}>
        {location ? (
          <WebView 
            ref={mapRef} 
            source={mapSource}
            onLoadEnd={() => {
              setMapReady(true);
              if (pendingMapScriptRef.current && mapRef.current) {
                mapRef.current.injectJavaScript(pendingMapScriptRef.current);
                pendingMapScriptRef.current = '';
              }
            }}
            onMessage={(e) => {
              try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'MARKER_CLICK') setSelectedShedId(data.id);
              } catch (error) {
                console.warn('Invalid map message:', error);
              }
            }}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="small" color="#FFB800" />
            <Text style={styles.mapPlaceholderTitle}>Finding your location</Text>
            <Text style={styles.mapPlaceholderSubtitle}>The map will appear once GPS is ready.</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.locateBtn, !location && styles.locateBtnDisabled]}
          disabled={!location}
          onPress={() => {
            if (mapRef.current && location) {
              mapRef.current.injectJavaScript(`map.flyTo([${location.latitude}, ${location.longitude}], 14);`);
            }
          }}
        >
          <Ionicons name="locate" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {initialLoad && sheds.length === 0 ? (
        <View style={styles.inlineLoadingWrap}>
          <ActivityIndicator size="small" color="#FFB800" />
          <Text style={styles.inlineLoadingText}>Loading nearby stations...</Text>
        </View>
      ) : null}

      <ScrollView 
        style={styles.listContainer} 
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData({ manualRefresh: true })} tintColor="#FFB800" />}
      >
        {sheds.length === 0 && !initialLoad ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={60} color="#BBB" />
            <Text style={styles.emptyTitle}>No Stations Found</Text>
          </View>
        ) : (
          sheds.map((shed) => {
            const fuelStocks = Array.isArray(shed.fuel_stocks) ? shed.fuel_stocks : [];
            const stock = activeFuel ? fuelStocks.find(f => f.fuel_type.trim().toLowerCase().includes(activeFuel.toLowerCase().trim())) : null;
            const isSelected = selectedShedId === shed.id;

            return (
              <TouchableOpacity 
                key={shed.id} 
                activeOpacity={0.8}
                style={[styles.shedCard, isSelected && styles.selectedCard]} 
                onPress={() => {
                  setSelectedShedId(shed.id);
                  if (mapRef.current) {
                    mapRef.current.injectJavaScript(`map.flyTo([${shed.latitude}, ${shed.longitude}], 15);`);
                  }
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.shedName} numberOfLines={1}>{shed.station_name}</Text>
                  <View style={[styles.stockBadge, {backgroundColor: shed.statusColor}]}>
                    <Text style={[styles.badgeText, {color: shed.textColor}]}>{shed.stockStatus}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.iconInfo}>
                    <Ionicons name="location-outline" size={14} color="#666" />
                    <Text style={styles.distText}>{shed.distance} km away</Text>
                  </View>
                  <View style={styles.iconInfo}>
                    <Ionicons name="people-outline" size={14} color="#666" />
                    <Text style={styles.qText}>{shed.reportCount === 0 ? "No reports" : `~${shed.avgQ} vehicles`}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.priceRow}>
                  <View style={styles.fuelLabel}>
                    <Text style={styles.fuelTagText}>{activeFuel || "None Selected"}</Text>
                  </View>
                  <Text style={styles.priceValue}>{stock ? `Rs. ${stock.price_rs}` : "No Data"}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    backgroundColor: '#FFB800', height: 110, paddingHorizontal: 20, paddingTop: 45, 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20, elevation: 4
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#000' },
  profileBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  mapWrapper: { height: 260, position: 'relative', margin: 15, borderRadius: 25, overflow: 'hidden', elevation: 5 },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8E7B6', paddingHorizontal: 24 },
  mapPlaceholderTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#222', textAlign: 'center' },
  mapPlaceholderSubtitle: { marginTop: 4, fontSize: 12, color: '#555', textAlign: 'center' },
  locateBtn: { position: 'absolute', bottom: 15, right: 15, backgroundColor: 'white', padding: 12, borderRadius: 30, elevation: 5 },
  locateBtnDisabled: { opacity: 0.55 },
  inlineLoadingWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginTop: 2, marginBottom: 8 },
  inlineLoadingText: { marginLeft: 8, fontSize: 13, fontWeight: '600', color: '#5F4B00' },
  listContainer: { flex: 1, paddingHorizontal: 15 },
  shedCard: { backgroundColor: '#FFB800', borderRadius: 22, padding: 18, marginBottom: 15, elevation: 3 },
  selectedCard: { borderColor: '#000', borderWidth: 2, transform: [{scale: 1.02}] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shedName: { fontWeight: 'bold', fontSize: 17, flex: 1, marginRight: 10 },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  iconInfo: { flexDirection: 'row', alignItems: 'center' },
  distText: { fontWeight: '600', color: '#333', marginLeft: 4, fontSize: 13 },
  qText: { fontSize: 13, color: '#444', marginLeft: 4 },
  divider: { height: 1.2, backgroundColor: 'rgba(0,0,0,0.08)', marginVertical: 14 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fuelLabel: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  fuelTagText: { fontSize: 12, fontWeight: '800', color: '#333' },
  priceValue: { fontSize: 22, fontWeight: '900', color: '#000' },
  emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.6 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10 }
});