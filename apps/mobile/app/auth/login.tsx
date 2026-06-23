import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Button } from '../../src/components/ui/Button';
import { ApiError } from '../../src/lib/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-950"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-8 pb-6">
          {error ? (
            <View className="bg-red-900/30 border border-red-800/50 rounded px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm">{error}</Text>
            </View>
          ) : null}

          <Text className="text-stone-400 text-sm mb-1">Email</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="you@example.com"
            placeholderTextColor="#78716c"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Password</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-6"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <Button onPress={handleLogin} loading={loading}>
            Sign In
          </Button>

          <Pressable
            onPress={() => router.replace('/auth/register')}
            className="mt-4 items-center"
          >
            <Text className="text-stone-400 text-sm">
              Don't have an account?{' '}
              <Text className="text-accent">Register</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
