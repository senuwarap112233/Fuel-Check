import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native'; 
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import { supabase } from './lib/supabase'; 
import { registerForFCM, setupFCMHandlers } from './src/services/fcm';

// Screen Imports
import LoginPage from './src/screens/LoginPage'; 
import SignupPage from './src/screens/SignupPage';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ShedTabs from './src/screens/ShedTabs'; 
import UserTabs from './src/screens/UserTabs';

const Stack = createNativeStackNavigator();
const prefix = Linking.createURL('/');

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Set up FCM handlers at app start (background + foreground)
  useEffect(() => {
    setupFCMHandlers();
  }, []);

  // Added a timeout to the database check so it never hangs the UI
  const fetchUserRole = async (userId) => {
    try {
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), 3500)
      );

      const roleCheck = (async () => {
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (profile) return 'resident';

        const { data: shed } = await supabase.from('sheds').select('id').eq('id', userId).maybeSingle();
        if (shed) return 'shed';

        return 'resident'; // Fallback
      })();

      return await Promise.race([roleCheck, timeout]);
    } catch (error) {
      console.log("Role fetch failed or timed out, defaulting to resident");
      return 'resident'; 
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        // Initial delay for Android native modules
        await new Promise(resolve => setTimeout(resolve, 1000));

        const { data: { user } } = await supabase.auth.getUser();
        
        if (user && isMounted) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            const role = await fetchUserRole(user.id);
            if (isMounted) {
              setUserRole(role);
              setSession(currentSession);
              // register for FCM (non-blocking)
              try { registerForFCM(); } catch (e) { console.warn('FCM init error', e); }
            }
          }
        }
      } catch (e) {
        console.error("Init Error", e);
      } finally {
        if (isMounted) setInitializing(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (currentSession && isMounted) {
        // When user logs in, we must ensure we don't hang if fetchUserRole is slow
        const role = await fetchUserRole(currentSession.user.id);
        if (isMounted) {
          setUserRole(role);
          setSession(currentSession);
            // register for FCM on auth change (non-blocking)
            try { registerForFCM(); } catch (e) { console.warn('FCM init error', e); }
          setInitializing(false); // Hide spinner immediately after data is set
        }
      } else {
        if (isMounted) {
          setSession(null);
          setUserRole(null);
          setInitializing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const linking = {
    prefixes: [prefix, 'fuelcheck://'],
    config: {
      screens: {
        LoginPage: 'login',
        SignupPage: 'signup',
        ResetPassword: 'reset-password',
        ShedDashboard: 'shed-dashboard',
        UserDashboard: 'user-dashboard',
      },
    },
  };

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF4CE' }}>
        <ActivityIndicator size="large" color="#FFB800" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session && session.user ? (
            userRole === 'shed' ? (
              <Stack.Screen name="ShedDashboard" component={ShedTabs} />
            ) : (
              <Stack.Screen name="UserDashboard" component={UserTabs} />
            )
          ) : (
            <Stack.Group>
              <Stack.Screen name="LoginPage" component={LoginPage} />
              <Stack.Screen name="SignupPage" component={SignupPage} />
              <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            </Stack.Group>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}