import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { supabase } from '../../lib/supabase';

// Register for FCM: request permission, get token, save to profiles.fcm_token
export async function registerForFCM() {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const permissionResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );

      if (permissionResult !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('Android notification permission was not granted');
        return null;
      }
    }

    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled && Platform.OS !== 'android') return null;

    const token = await messaging().getToken();
    if (!token) return null;

    const { data: { user } = {} } = await supabase.auth.getUser();
    if (user && user.id) {
      await supabase
        .from('profiles')
        .update({ fcm_token: token, fcm_token_updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }

    // Listen for token refresh and update DB
    const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
      try {
        const { data: { user } = {} } = await supabase.auth.getUser();
        if (user && user.id) {
          await supabase
            .from('profiles')
            .update({ fcm_token: newToken, fcm_token_updated_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (e) {
        console.warn('Failed to update refreshed FCM token:', e?.message || e);
      }
    });

    // return unsubscribe to allow caller to clean up if needed
    return unsubscribe;
  } catch (err) {
    console.warn('FCM registration failed:', err?.message || err);
    return null;
  }
}

export async function getFCMToken() {
  try {
    return await messaging().getToken();
  } catch (e) {
    console.warn('Failed to get FCM token', e?.message || e);
    return null;
  }
}

// Set up background and foreground message handlers
export function setupFCMHandlers() {
  try {
    // Handle messages when app is in background or terminated
    messaging().setBackgroundMessageHandler(async (message) => {
      console.log('Background notification received:', message.messageId, message.notification);
      // Message is handled by FCM automatically; you can add custom logic here if needed
      // e.g., store in local notification db, update app state, etc.
    });

    // Handle messages when app is in foreground
    const unsubscribe = messaging().onMessage(async (message) => {
      console.log('Foreground notification received:', message.messageId, message.notification);
      // You can display a local notification or update UI here
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to setup FCM handlers:', err?.message || err);
    return null;
  }
}
