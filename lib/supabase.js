import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dssipdkvbdiffplqcept.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzc2lwZGt2YmRpZmZwbHFjZXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTc5MTMsImV4cCI6MjA5MjQzMzkxM30.OCRa_LjPA-J5dA32YLmzEQFo_csK2h1SiL0wD467xL8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      // Remove async/await - return the promise directly
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});