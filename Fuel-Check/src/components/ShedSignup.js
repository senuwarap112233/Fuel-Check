import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  ScrollView, Alert, ActivityIndicator, Modal 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

// Add { navigation } to the function arguments
export default function ShedSignup({ navigation }) {
  const [doc, setDoc] = useState(null);
  const [location, setLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ 
    name: '', owner: '', contact: '', email: '', 
    addr: '', dist: '', pass: '', conf: '' 
  });

  const getGPS = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Error", "Location permission denied.");
    const loc = await Location.getCurrentPositionAsync({});
    setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    Alert.alert("Success", "GPS Location Captured.");
  };

  const handleSignup = async () => {
    const { name, owner, contact, email, addr, dist, pass, conf } = form;

    if (!name || !owner || !contact || !email || !addr || !dist || !pass || !conf) {
      return Alert.alert("Required", "All text fields are mandatory.");
    }
    if (!location) return Alert.alert("Required", "GPS or Map location is mandatory.");
    if (!doc) return Alert.alert("Required", "Please upload the license document.");
    if (!checked) return Alert.alert("Required", "Legal confirmation is required.");
    if (pass !== conf) return Alert.alert("Error", "Passwords do not match.");

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, 
        password: pass,
      });

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Authentication failed to return a User ID.");

      const b64 = await FileSystem.readAsStringAsync(doc.uri, { encoding: 'base64' });
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('verification-docs')
        .upload(`${userId}/${Date.now()}.pdf`, decode(b64), { 
          contentType: 'application/pdf',
          upsert: true 
        });
      
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('sheds').insert([{
        id: userId,
        station_name: name,
        owner_name: owner,
        contact_no: contact,
        email: email,
        address: addr,
        district: dist,
        latitude: location.lat,
        longitude: location.lng,
        document_url: uploadData.path
      }]);

      if (dbError) throw dbError;
      await supabase.auth.signOut();
      Alert.alert("Success", "Fuel Station Registered! You can now login.");
    } catch (err) {
      console.error("FULL ERROR LOG:", err);
      Alert.alert("Signup Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const leafletHTML = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>#map { height: 100vh; width: 100vw; margin: 0; }</style></head>
    <body><div id="map"></div><script>
    var map = L.map('map').setView([6.9271, 79.8612], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    var marker = L.marker([6.9271, 79.8612], {draggable: true}).addTo(map);
    marker.on('dragend', function(e) { window.ReactNativeWebView.postMessage(JSON.stringify(marker.getLatLng())); });
    map.on('click', function(e) { marker.setLatLng(e.latlng); window.ReactNativeWebView.postMessage(JSON.stringify(e.latlng)); });
    </script></body></html>`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Register Fuel Station</Text>
      
      <Text style={styles.label}>Fuel Station Name *</Text>
      <TextInput style={styles.input} onChangeText={(t) => setForm({...form, name: t})} />
      
      <Text style={styles.label}>Location *</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btnSm} onPress={getGPS}><Text style={styles.bold}>Use GPS</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnSm} onPress={() => setShowMap(true)}><Text style={styles.bold}>Open Map</Text></TouchableOpacity>
      </View>
      {location && <Text style={styles.green}>Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</Text>}

      <Text style={styles.label}>Owner/ Manager Name *</Text>
      <TextInput style={styles.input} onChangeText={(t) => setForm({...form, owner: t})} />
      <Text style={styles.label}>Contact Number *</Text>
      <TextInput style={styles.input} keyboardType="phone-pad" onChangeText={(t) => setForm({...form, contact: t})} />
      <Text style={styles.label}>Email Address *</Text>
      <TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => setForm({...form, email: t})} />
      <Text style={styles.label}>Station Address *</Text>
      <TextInput style={styles.input} onChangeText={(t) => setForm({...form, addr: t})} />
      <Text style={styles.label}>District *</Text>
      <TextInput style={styles.input} placeholder="e.g. Colombo" onChangeText={(t) => setForm({...form, dist: t})} />
      <Text style={styles.label}>Password *</Text>
      <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setForm({...form, pass: t})} />
      <Text style={styles.label}>Confirm Password *</Text>
      <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setForm({...form, conf: t})} />

     <View style={styles.row}>
  <Text style={styles.uploadLabel}>
    Upload fuel retail license / CPC or IOC authorization letter *
  </Text>
  
  <TouchableOpacity 
    style={styles.btnSm} 
    onPress={async () => {
      let r = await DocumentPicker.getDocumentAsync({type: 'application/pdf'});
      if(!r.canceled) setDoc(r.assets[0]);
    }}
  >
    <Text style={styles.bold}>{doc ? "Selected" : "Upload"}</Text>
  </TouchableOpacity>
</View>

      <TouchableOpacity style={styles.checkRow} onPress={() => setChecked(!checked)}>
        <View style={[styles.box, checked && styles.checked]}>
           {checked && <Ionicons name="checkmark" size={14} color="white" />}
        </View>
        <Text style={styles.text}> I confirm that this fuel station is legally registered and authorized to sell fuel in Sri Lanka. *</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.mainBtn} onPress={handleSignup} disabled={loading}>
        {loading ? <ActivityIndicator color="black" /> : <Text style={styles.mainBtnText}>Sign Up</Text>}
      </TouchableOpacity>

      {/* --- ADDED FOOTER LINK --- */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('LoginPage')}>
          <Text style={styles.linkText}>Login</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showMap} animationType="slide">
        <View style={{flex: 1}}>
          <WebView originWhitelist={['*']} source={{ html: leafletHTML }} onMessage={(e) => setLocation(JSON.parse(e.nativeEvent.data))} />
          <TouchableOpacity style={styles.closeMap} onPress={() => setShowMap(false)}><Text style={styles.white}>Save Location</Text></TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Main Layout
  container: { 
    flex: 1, 
    backgroundColor: '#FFF4CE' 
  },
  content: { 
    padding: 25, 
    paddingBottom: 50 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20,
    color: '#000'
  },

  // Form Elements
  label: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    marginBottom: 5,
    color: '#333'
  },
  input: { 
    backgroundColor: '#FFF', 
    height: 48, 
    borderRadius: 8, 
    marginBottom: 15, 
    paddingHorizontal: 12, 
    borderWidth: 1, 
    borderColor: '#EEE' ,
    color: '#000'
  },

  // Document Upload Row (Optimized for wrapping text)
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 15, 
    alignItems: 'center',
    width: '100%' 
  },
  uploadLabel: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    flex: 1,           // Allows text to wrap and take available space
    marginRight: 10,    // Space between text and button
    color: '#333'
  },
  btnSm: { 
    backgroundColor: '#FFB800', 
    width: '35%',      // Reduced width to give label more room
    height: 40, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  bold: { 
    fontWeight: 'bold',
    color: '#000'
  },

  // Messages & Status
  green: { 
    color: 'green', 
    fontSize: 11, 
    textAlign: 'center', 
    marginBottom: 10, 
    fontWeight: 'bold' 
  },

  // Checkbox Section
  checkRow: { 
    flexDirection: 'row', 
    marginTop: 15, 
    alignItems: 'center' 
  },
  box: { 
    width: 22, 
    height: 22, 
    borderWidth: 1, 
    borderColor: '#5D49B8', 
    marginRight: 10, 
    borderRadius: 4, 
    justifyContent: 'center',
    alignItems: 'center'
  },
  checked: { 
    backgroundColor: '#5D49B8' 
  },
  text: { 
    fontSize: 12, 
    flex: 1,
    color: '#333'
  },

  // Buttons
  mainBtn: { 
    backgroundColor: '#FFB800', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 25 
  },
  mainBtnText: { 
    fontWeight: 'bold', 
    fontSize: 18,
    color: '#000'
  },

  // Map Overlay Elements
  closeMap: { 
    position: 'absolute', 
    bottom: 40, 
    alignSelf: 'center', 
    backgroundColor: '#000', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 10 
  },
  white: { 
    color: '#FFF', 
    fontWeight: 'bold' 
  },

  // Footer / Navigation Links
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 25,
    paddingBottom: 20 
  },
  footerText: { 
    color: '#000', 
    fontSize: 14 
  },
  linkText: { 
    color: '#FFB800', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
});