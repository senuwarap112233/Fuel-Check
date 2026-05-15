import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
//import UserDashboard from './src/screens/UserDashboard';

export default function App() {
  return (
    <View style={styles.container}>
      
          <View style={styles.container}>
              <View style={styles.header}>
                <Text style={styles.headerText}>Resident Dashboard</Text>
              </View>
              
              <View style={styles.content}>
                <Text style={styles.welcome}>Welcome,</Text>
                <Text style={styles.email}>Email</Text>
                
                <View style={styles.statusBox}>
                  <Text style={styles.statusText}>Profile Verified ✅</Text>
                </View>
        
                  <Text style={styles.logoutBtnText}>Logout</Text>
  
              </View>
            </View>

      <StatusBar style="auto" />
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
