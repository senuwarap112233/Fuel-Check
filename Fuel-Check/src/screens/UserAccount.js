import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function UserAccount({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState([]);
  
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchUserData(), fetchUserReports()]);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserReports();
    setRefreshing(false);
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          email: data.email || user.email 
        });
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error.message);
    }
  };

  const fetchUserReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('community_reports')
        .select(`
          id,
          fuel_type,
          stock_level,
          queue_length,
          comment,
          created_at,
          sheds (station_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Reports Fetch Error:", error.message);
    }
  };

  const handleUpdate = async () => {
    if (!profile.first_name.trim() || !profile.last_name.trim()) {
      Alert.alert("Invalid Input", "First and Last name cannot be empty.");
      return;
    }

    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name
        })
        .eq('id', user.id);

      if (error) throw error;
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Update Failed", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigation.replace('LoginPage');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFB800" colors={['#FFB800']} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Fuel Check</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="black" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={50} color="#FFB800" />
            </View>
            <Text style={styles.userEmail}>{profile.email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Verified User</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Account Details</Text>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name</Text>
              <TextInput 
                style={styles.input}
                value={profile.first_name}
                onChangeText={(txt) => setProfile({...profile, first_name: txt})}
                placeholder="Enter First Name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput 
                style={styles.input}
                value={profile.last_name}
                onChangeText={(txt) => setProfile({...profile, last_name: txt})}
                placeholder="Enter Last Name"
              />
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={updating}>
              {updating ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>

          {/* User Reports Section */}
          <View style={styles.reportsHeaderRow}>
            <Text style={styles.sectionTitle}>My Recent Reports</Text>
            <Ionicons name="time-outline" size={20} color="#999" />
          </View>
          
          {reports.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Pull down to refresh or submit a report!</Text>
            </View>
          ) : (
            reports.map((item) => (
              <View key={item.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportShedName}>{item.sheds?.station_name || 'Verified Station'}</Text>
                  <Text style={styles.reportDate}>{formatDate(item.created_at)}</Text>
                </View>
                
                <View style={styles.reportDetails}>
                  <View style={styles.reportTag}>
                    <Text style={styles.reportTagText}>{item.fuel_type}</Text>
                  </View>
                  <View style={[styles.reportTag, { backgroundColor: '#E3F2FD' }]}>
                    <Text style={[styles.reportTagText, { color: '#1976D2' }]}>Queue: {item.queue_length}</Text>
                  </View>
                </View>

                <Text style={styles.reportStatus}>
                   Stock Level: <Text style={{ fontWeight: 'bold' }}>{item.stock_level}</Text>
                </Text>

                {item.comment ? (
                  <Text style={styles.reportComment}>"{item.comment}"</Text>
                ) : null}
              </View>
            ))
          )}

          <Text style={styles.footerText}>
            Joined Fuel Check in 2026 • Helping Sri Lankans find fuel efficiently.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF4CE' },
  header: { backgroundColor: '#FFB800', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  logoutText: { fontWeight: 'bold', marginLeft: 5 },
  content: { padding: 20 },
  profileHeader: { alignItems: 'center', marginBottom: 30 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  userEmail: { marginTop: 15, fontSize: 16, color: '#555', fontWeight: '500' },
  badge: { marginTop: 8, backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#2E7D32', fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  formCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 2, marginTop: 15 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#666' },
  input: { backgroundColor: '#F9F9F9', height: 50, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#EEE' },
  saveBtn: { backgroundColor: '#FFB800', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontWeight: 'bold', fontSize: 16 },
  reportsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 35, marginBottom: 15 },
  reportCard: { backgroundColor: '#FFF', borderRadius: 15, padding: 15, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: '#FFB800' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  reportShedName: { fontWeight: 'bold', fontSize: 15 },
  reportDate: { fontSize: 11, color: '#999' },
  reportDetails: { flexDirection: 'row', marginBottom: 8 },
  reportTag: { backgroundColor: '#FFF4CE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  reportTagText: { fontSize: 11, fontWeight: 'bold' },
  reportStatus: { fontSize: 13, color: '#444' },
  reportComment: { fontSize: 12, color: '#666', fontStyle: 'italic', marginTop: 8, backgroundColor: '#F5F5F5', padding: 8, borderRadius: 8 },
  emptyCard: { padding: 30, alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CCC' },
  emptyText: { color: '#888', fontSize: 13 },
  footerText: { textAlign: 'center', marginTop: 40, color: '#999', fontSize: 11, paddingBottom: 30 }
});