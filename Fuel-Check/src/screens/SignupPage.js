import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UserSignup from '../components/UserSignup';
import ShedSignup from '../components/ShedSignup';

// 1. Receive the { navigation } prop here
export default function SignupPage({ navigation }) {
  const [activeTab, setActiveTab] = useState('user');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Fuel Check</Text>
      </View>
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'user' ? styles.activeTab : styles.inactiveTab]} 
            onPress={() => setActiveTab('user')}
          >
            <Text style={styles.tabText}>Resident</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'shed' ? styles.activeTab : styles.inactiveTab]} 
            onPress={() => setActiveTab('shed')}
          >
            <Text style={styles.tabText}>Fuel Shed</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Pass navigation to the child components */}
        {activeTab === 'user' ? (
          <UserSignup navigation={navigation} /> 
        ) : (
          <ShedSignup navigation={navigation} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFB800' },
  headerBar: { backgroundColor: '#FFB800', paddingVertical: 10, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#000' },
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 40,
    marginTop: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB800',
    overflow: 'hidden',
    height: 45
  },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeTab: { backgroundColor: '#FFB800' },
  inactiveTab: { backgroundColor: '#FFF4CE' },
  tabText: { fontWeight: 'bold', fontSize: 16 }
});