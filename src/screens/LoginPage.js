import React, { useState } from 'react';
// ADD 'Alert' TO THE LIST BELOW
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import UserLogin from '../components/UserLogin';
import ShedLogin from '../components/ShedLogin';

export default function LoginPage({ navigation }) {
  const [activeTab, setActiveTab] = useState('user');

  const goToSignup = () => {
    // This will now work because 'Alert' is imported
    navigation.navigate('SignupPage'); 
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'user' ? styles.activeTab : styles.inactiveTab]} 
            onPress={() => setActiveTab('user')}
          >
            <Text style={styles.tabText}>User</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'shed' ? styles.activeTab : styles.inactiveTab]} 
            onPress={() => setActiveTab('shed')}
          >
            <Text style={styles.tabText}>Shed</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'user' ? (
          <UserLogin navigation={navigation} />
        ) : (
          <ShedLogin navigation={navigation} />
        )}

        <View style={styles.footer}>
          <Text></Text>
          <TouchableOpacity onPress={goToSignup}>
            <Text style={styles.link}></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ... styles stay the same ...

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFB800' },
  headerBar: { backgroundColor: '#FFB800', paddingVertical: 10, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#000' },
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  content: { paddingBottom: 30 },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 40,
    marginTop: 20,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB800',
    overflow: 'hidden',
    height: 45
  },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeTab: { backgroundColor: '#FFB800' },
  inactiveTab: { backgroundColor: '#FFF4CE' },
  tabText: { fontWeight: 'bold', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { color: '#FFB800', fontWeight: 'bold' }
});