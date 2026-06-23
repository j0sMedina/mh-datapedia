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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    if (!username || !email || !password || !confirm) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username) || username.length < 3) {
      setError('Username must be 3+ characters: letters, numbers, _ or -');
      return;
    }
    setLoading(true);
    try {
      await register(email, username, password);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError('Email or username already taken.');
      } else if (e instanceof ApiError && e.status === 401) {
        setError('Registration not allowed. Please try again later.');
      } else if (e instanceof ApiError && (e.body as { message?: string })?.message) {
        setError((e.body as { message: string }).message);
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

          <Text className="text-stone-400 text-sm mb-1">Username</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="HunterName123"
            placeholderTextColor="#78716c"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
          />

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
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-4"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <Text className="text-stone-400 text-sm mb-1">Confirm Password</Text>
          <TextInput
            className="bg-stone-900 border border-stone-700 rounded px-3 py-3 text-stone-50 text-sm mb-6"
            placeholder="••••••••"
            placeholderTextColor="#78716c"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Button onPress={handleRegister} loading={loading}>
            Create Account
          </Button>

          <Pressable
            onPress={() => router.replace('/auth/login')}
            className="mt-4 items-center"
          >
            <Text className="text-stone-400 text-sm">
              Already have an account?{' '}
              <Text className="text-accent">Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
