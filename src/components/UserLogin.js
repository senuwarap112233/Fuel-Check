import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function UserLogin({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return Alert.alert("Error", "Fill all fields.");
    
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      return Alert.alert("Login Failed", error.message);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const userMetadata = user.user_metadata || {};
      await supabase.from('profiles').upsert([{
        id: user.id,
        first_name: userMetadata.first_name || '',
        last_name: userMetadata.last_name || '',
        email: user.email || email
      }], { onConflict: 'id' });
    }

    // Verify if they are a resident in the 'profiles' table
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', data.user.id).single();
    
    setLoading(false);
    if (profile) {
      navigation.replace('UserDashboard');
    } else {
      await supabase.auth.signOut();
      Alert.alert("Error", "This is not a Resident account.");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return Alert.alert("Error", "Please enter your email address first.");

    setLoading(true);
    
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
      <Text style={styles.label}>Email Address</Text>
      <TextInput style={styles.input} autoCapitalize="none" onChangeText={setEmail} />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrap}>
        <TextInput style={[styles.input, styles.passwordInput]} secureTextEntry={!showPassword} onChangeText={setPassword} />
        <TouchableOpacity style={styles.passwordIconBtn} onPress={() => setShowPassword((prev) => !prev)}>
          <Image source={require('../../assets/viewpassword.png')} style={styles.passwordIcon} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleForgotPassword}>
        <Text style={styles.link}>Forgot your password..?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.mainBtn} onPress={handleSignIn} disabled={loading}>
        {loading ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Sign In</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('SignupPage')}>
        <Text style={styles.signupText}>Don't have an account? <Text style={styles.linkBold}>Sign Up</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontWeight: 'bold', marginBottom: 5 },
  input: { backgroundColor: '#FFF', height: 48, borderRadius: 8, marginBottom: 15, paddingHorizontal: 12, borderWidth: 1, color: '#000', borderColor: '#EEE' },
  passwordWrap: { position: 'relative', marginBottom: 15 },
  passwordInput: { marginBottom: 0, paddingRight: 44 },
  passwordIconBtn: { position: 'absolute', right: 12, top: 12 },
  link: { color: '#666', marginBottom: 20, fontSize: 13 },
  linkBold: { color: '#FFB800', fontWeight: 'bold' },
  signupText: { fontSize: 16 },
  passwordIcon: { width: 24, height: 24 },
  mainBtn: { backgroundColor: '#FFB800', padding: 15, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', fontSize: 18 },
  footer: { marginTop: 20, alignItems: 'center' }
});