import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
const FUEL_TYPES = ["Petrol 92 octane", "Petrol 95 octane", "Kerosene", "Super Diesel", "Diesel"];

// Edge function credentials for FCM notification trigger (non-blocking call)
const SUPABASE_PROJECT_URL = 'https://dssipdkvbdiffplqcept.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzc2lwZGt2YmRpZmZwbHFjZXB0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg1NzkxMywiZXhwIjoyMDkyNDMzOTEzfQ.Ibndue2yngI_XGNuw1DnNif5U21h1eTbcDlmoTTnFuY'; 

export default function ShedSubmitReport() {
  const [selectedType, setSelectedType] = useState(FUEL_TYPES[0]);
  const [currentStock, setCurrentStock] = useState(0);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [lastUpdate, setLastUpdate] = useState("Never");
  
  const [inputStock, setInputStock] = useState('');
  const [inputPrice, setInputPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Date Picker States
  const [arrivalDate, setArrivalDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    fetchCurrentStats();
  }, [selectedType]);

  const fetchCurrentStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('fuel_stocks')
      .select('*')
      .eq('shed_id', user.id)
      .eq('fuel_type', selectedType)
      .single();

    if (data) {
      setCurrentStock(data.stock_liters);
      setCurrentPrice(data.price_rs);
      setLastUpdate(new Date(data.last_updated).toLocaleDateString());
      if (data.next_arrival) setArrivalDate(new Date(data.next_arrival));
    } else {
      setCurrentStock(0);
      setCurrentPrice(0);
      setLastUpdate("No data");
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios'); // iOS stays open, Android closes
    if (selectedDate) setArrivalDate(selectedDate);
  };

  // Fire-and-forget call to trigger the restock processing edge function
  // This runs in the background without blocking the user
  const triggerRestockNotificationAsync = async () => {
    try {
      const fn_url = `${SUPABASE_PROJECT_URL}/functions/v1/process-restocks`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      };
      
      // Fire without awaiting — returns immediately
      fetch(fn_url, {
        method: 'POST',
        headers,
        body: '{}',
      }).catch(err => console.warn('Background FCM trigger error:', err?.message || err));
    } catch (err) {
      console.warn('Failed to trigger restock notifications:', err?.message || err);
    }
  };

  const handleSave = async () => {
    if (!inputStock || !inputPrice) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('fuel_stocks')
      .upsert({ 
        shed_id: user.id, 
        fuel_type: selectedType, 
        stock_liters: parseFloat(inputStock), 
        price_rs: parseFloat(inputPrice),
        next_arrival: arrivalDate.toISOString().split('T')[0], // YYYY-MM-DD format
        last_updated: new Date()
      }, { onConflict: 'shed_id,fuel_type' });

    if (error) {
      setLoading(false);
      Alert.alert("Error", error.message);
      return;
    }

    // After successful fuel_stocks save, create restock_events row for FCM trigger
    const { error: enqueueError } = await supabase
      .from('restock_events')
      .insert({
        shed_id: user.id,
        fuel_type: selectedType,
        processed: false,
        attempts: 0,
      });

    setLoading(false);
    if (enqueueError) {
      console.warn('Failed to enqueue restock event:', enqueueError.message);
      // Don't alert user; the stock was updated successfully, just the event queue failed
    }

    Alert.alert("Success", "Report submitted!");
    setInputStock(''); setInputPrice('');
    fetchCurrentStats();
    
    // Trigger restock notifications in the background (non-blocking)
    triggerRestockNotificationAsync();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <View style={styles.profileCircle}><Text>👤</Text></View>
      </View>

      <Text style={styles.mainTitle}>Update Stocks & Prices</Text>

      <View style={styles.card}>
        <Text style={styles.lastUpdate}>Last Update : {lastUpdate}</Text>
        
        <View style={styles.row}>
          <Text style={styles.label}>Fuel Type :</Text>
          <View style={styles.pickerBorder}>
            <Picker selectedValue={selectedType} onValueChange={(v) => setSelectedType(v)} style={styles.picker}>
              {FUEL_TYPES.map(t => <Picker.Item key={t} label={t} value={t} />)}
            </Picker>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View><Text style={styles.statLabel}>Current Stock</Text><Text style={styles.statValue}>{currentStock}L</Text></View>
          <View><Text style={styles.statLabel}>Current Price</Text><Text style={styles.statValue}>Rs.{currentPrice}</Text></View>
        </View>

        <Text style={styles.inputLabel}>New Stock (Liters)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={inputStock} onChangeText={setInputStock} />

        <Text style={styles.inputLabel}>New Price (Rs)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={inputPrice} onChangeText={setInputPrice} />

        {/* Calendar Picker Field */}
        <Text style={styles.inputLabel}>Next Arrival Date</Text>
        <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateText}>{arrivalDate.toDateString()}</Text>
          <Ionicons name="calendar-outline" size={20} color="#666" />
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={arrivalDate}
            mode="date"
            display="default"
            minimumDate={new Date()} // QA: Prevents picking past dates
            onChange={onDateChange}
          />
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  header: { backgroundColor: '#FFB800', height: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 40 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  profileCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  mainTitle: { fontSize: 20, fontWeight: 'bold', margin: 20 },
  card: { backgroundColor: '#FFF', margin: 15, borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#FFB800' },
  lastUpdate: { fontSize: 10, color: '#999', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  label: { fontWeight: 'bold', width: 90 },
  pickerBorder: { flex: 1, borderWidth: 1, borderColor: '#FFB800', borderRadius: 8 },
  picker: { height: 50,color: '#000' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statLabel: { fontSize: 11, color: '#666' },
  statValue: { fontSize: 16, fontWeight: 'bold' },
  inputLabel: { fontWeight: 'bold', marginBottom: 5, fontSize: 13 },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 10, marginBottom: 15 },
  dateSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, marginBottom: 25 },
  dateText: { color: '#333' },
  saveBtn: { backgroundColor: '#FFB800', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontWeight: 'bold', fontSize: 16 }
});