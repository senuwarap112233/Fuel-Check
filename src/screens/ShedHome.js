import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase'; // Adjust path if needed

const FUEL_TYPES = [
  { name: "Petrol 92 octane", color: "#FF9933" },
  { name: "Petrol 95 octane", color: "#4CAF50" },
  { name: "Diesel", color: "#FF3D00" },
  { name: "Super Diesel", color: "#FF9100" },
  { name: "Kerosene", color: "#9E9E9E" }
];

export default function ShedHome() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stocks, setStocks] = useState([]);

  const fetchStocks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('fuel_stocks')
        .select('*')
        .eq('shed_id', user.id);

      if (error) throw error;

      // Map the 5 static types against DB results
      const mergedData = FUEL_TYPES.map(typeObj => {
        const dbMatch = data?.find(item => item.fuel_type === typeObj.name);
        return {
          name: typeObj.name,
          color: typeObj.color,
          stock: dbMatch?.stock_liters ?? 0,
          price: dbMatch?.price_rs ?? 0,
          date: dbMatch?.next_arrival ?? 'N/A'
        };
      });

      setStocks(mergedData);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStocks(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStocks();
  }, []);

  if (loading) return (
    <View style={styles.loader}><ActivityIndicator size="large" color="#FFB800" /></View>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
        <View style={styles.profileCircle}>
           <Text style={{fontSize: 20}}>👤</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.mainTitle}>Today's Stock Summary</Text>

        {stocks.map((item, index) => (
          <View key={index} style={[styles.fuelCard, { backgroundColor: item.color }]}>
            <View style={styles.cardTop}>
              <Text style={styles.fuelName}>{item.name}</Text>
              <Text style={styles.priceText}>Price : Rs.{item.price}</Text>
            </View>
            
            <Text style={styles.stockValue}>Stock: {item.stock.toLocaleString()} L</Text>
            <Text style={styles.dateText}>Arrived Date : {item.date}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF4CE' },
  header: { 
    backgroundColor: '#FFB800', 
    height: 110, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingTop: 45 
  },
  headerTitle: { fontSize: 26, fontWeight: 'bold' },
  profileCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 15 },
  mainTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 20, color: '#000' },
  fuelCard: { 
    borderRadius: 20, 
    padding: 18, 
    marginBottom: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  fuelName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  priceText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  stockValue: { color: '#FFF', fontSize: 28, fontWeight: 'bold', marginVertical: 5 },
  dateText: { color: '#FFF', fontSize: 11, opacity: 0.9 }
});