import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

// Add { navigation } here to use the navigation prop
const UserSignup = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fName: '', lName: '', email: '', pass: '', conf: '' });

  const handleSignUp = async () => {
    const { fName, lName, email, pass, conf } = form;

    if (!fName || !lName || !email || !pass || !conf) {
      return Alert.alert("Required", "All fields are mandatory.");
    }
    if (pass !== conf) return Alert.alert("Error", "Passwords mismatch.");

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password: pass,
        options: { data: { role: 'user' } }
      });
      if (authError) throw authError;

      const { error: dbError } = await supabase.from('profiles').insert([{
        id: data.user.id,
        first_name: fName,
        last_name: lName,
        email: email
      }]);
      if (dbError) throw dbError;

      await supabase.auth.signOut();

      Alert.alert("Success", "Resident registered! Check email.");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Resident/ User Account</Text>
      <Text style={styles.label}>First Name *</Text>
      <TextInput style={styles.input} onChangeText={(t) => setForm({...form, fName: t})} />
      <Text style={styles.label}>Last Name *</Text>
      <TextInput style={styles.input} onChangeText={(t) => setForm({...form, lName: t})} />
      <Text style={styles.label}>Email *</Text>
      <TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" onChangeText={(t) => setForm({...form, email: t})} />
      <Text style={styles.label}>Password *</Text>
      <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setForm({...form, pass: t})} />
      <Text style={styles.label}>Confirm Password *</Text>
      <TextInput style={styles.input} secureTextEntry onChangeText={(t) => setForm({...form, conf: t})} />

      <TouchableOpacity style={styles.mainBtn} onPress={handleSignUp} disabled={loading}>
        {loading ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Sign Up</Text>}
      </TouchableOpacity>

      {/* --- ADDED FOOTER LINK --- */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('LoginPage')}>
          <Text style={styles.linkText}>Login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE' },
  content: { padding: 25 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  input: { backgroundColor: '#FFF',color: '#000',  height: 45, borderRadius: 8, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEE' },
  mainBtn: { backgroundColor: '#FFB800', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: 'bold', fontSize: 16 },
  // --- ADDED STYLES ---
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    marginTop: 25,
    paddingBottom: 20 
  },
  footerText: { color: '#000', fontSize: 14 },
  linkText: { color: '#FFB800', fontWeight: 'bold', fontSize: 14 }
});

export default UserSignup;