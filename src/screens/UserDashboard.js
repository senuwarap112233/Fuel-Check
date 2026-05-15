import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';

// GO UP TWO LEVELS: screens -> src -> root
import { supabase } from '../../lib/supabase'; 

export default function UserDashboard({ navigation }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error) {
        Alert.alert("User Load Failed", error.message);
        return;
      }

      setUser(data?.user ?? null);
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('LoginPage');
    } catch (error) {
      Alert.alert("Logout Failed", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Resident Dashboard</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.welcome}>Welcome,</Text>
        <Text style={styles.email}>{user?.email || "Resident"}</Text>
        
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Profile Verified ✅</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  header: { backgroundColor: '#FFB800', padding: 20, paddingTop: 50, alignItems: 'center' },
  headerText: { fontSize: 22, fontWeight: '900', color: '#000' },
  content: { flex: 1, padding: 30, justifyContent: 'center', alignItems: 'center' },
  welcome: { fontSize: 18, color: '#555' },
  email: { fontSize: 20, fontWeight: 'bold', marginBottom: 30 },
  statusBox: { backgroundColor: '#FFF', padding: 15, borderRadius: 10, width: '100%', alignItems: 'center', marginBottom: 40, borderWidth: 1, borderColor: '#DDD' },
  statusText: { color: '#5D49B8', fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#FF3B30', width: '100%', padding: 15, borderRadius: 12, alignItems: 'center' },
  logoutBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 }
});