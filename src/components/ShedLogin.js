import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function ShedLogin({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      return Alert.alert("Error", "Please enter both email and password.");
    }

    setLoading(true);
    try {
      // 1. Authenticate with Supabase
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInError) throw signInError;

      // 2. Role Verification: Ensure they exist in the 'sheds' table
      const { data: shedData, error: dbError } = await supabase
        .from('sheds')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (dbError || !shedData) {
        await supabase.auth.signOut();
        return Alert.alert("Account Mismatch", "This is not a registered Fuel Station account.");
      }

      // 3. Navigate to Dashboard
      // We use 'replace' so they can't go back to login using the back button
      navigation.replace('ShedDashboard');
      
    } catch (error) {
      Alert.alert("Sign In Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASSWORD RESET IMPLEMENTATION ---
 const handleForgotPassword = async () => {
    if (!email) return Alert.alert("Error", "Please enter your email address first.");

    setLoading(true);
    
    // Using Magic Link method
    // Using Magic Link method
       const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://fuelcheckresetpass.vercel.app/',
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert(
        "Link Sent", 
        "A password reset link has been sent to your email. Please click it to continue.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fuel Station Login</Text>
      <Text style={styles.subtitle}>Access your station account to update fuel stock, prices, and reports.</Text>

      <Text style={styles.label}>Email Address</Text>
      <TextInput 
        style={styles.input} 
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={(text) => setEmail(text)}
        value={email}
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrap}>
        <TextInput 
          style={[styles.input, styles.passwordInput]} 
          secureTextEntry={!showPassword}
          onChangeText={(text) => setPassword(text)}
          value={password}
        />
        <TouchableOpacity style={styles.passwordIconBtn} onPress={() => setShowPassword((prev) => !prev)}>
          <Image source={require('../../assets/viewpassword.png')} style={styles.passwordIcon} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.forgotPass}>Forgot your password..?</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.mainBtn} 
        onPress={handleSignIn} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="black" />
        ) : (
          <Text style={styles.btnText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('SignupPage')}>
              <Text style={styles.signupText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
            </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4CE', padding: 25 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 5 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 20 },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 5, color: '#000' },
  input: { backgroundColor: '#FFF', height: 48,color: '#000', borderRadius: 8, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEE' },
  passwordWrap: { position: 'relative', marginBottom: 15 },
  passwordInput: { marginBottom: 0, paddingRight: 44 },
  passwordIconBtn: { position: 'absolute', right: 12, top: 12 },
  forgotPass: { fontSize: 13, color: '#666', marginBottom: 20 },
  mainBtn: { backgroundColor: '#FFB800', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { fontWeight: 'bold', fontSize: 18, color: '#000' },
  footer: { marginTop: 20, alignItems: 'center' },
  linkBold: { color: '#FFB800', fontWeight: 'bold' },
  signupText: { fontSize: 16 },
  passwordIcon: { width: 24, height: 24 },
});