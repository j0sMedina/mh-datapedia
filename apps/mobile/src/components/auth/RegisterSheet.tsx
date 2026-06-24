import { forwardRef, useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';

interface RegisterSheetProps {
  onSwitchToLogin: () => void;
}

export const RegisterSheet = forwardRef<BottomSheetModal, RegisterSheetProps>(
  ({ onSwitchToLogin }, ref) => {
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
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
        setUsername(''); setEmail(''); setPassword(''); setConfirm('');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setError('Email or username already taken.');
        } else if (e instanceof ApiError && (e.body as { message?: string })?.message) {
          setError((e.body as { message: string }).message);
        } else {
          setError('Something went wrong. Try again.');
        }
      } finally {
        setLoading(false);
      }
    }

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.6}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['58%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
        onDismiss={() => {
          setError('');
          setUsername('');
          setEmail('');
          setPassword('');
          setConfirm('');
        }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.diamond}>◆</Text>
            <Text style={styles.title}>Hunter Register</Text>
            <View style={styles.line} />
          </View>

          <Text style={styles.subtitle}>Create an account to save favorites and submit strategies.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Username"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Confirm Password"
            placeholderTextColor="rgba(255,255,255,0.25)"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            style={styles.input}
          />

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.createBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createText}>Create Account</Text>
            )}
          </Pressable>

          <Pressable onPress={onSwitchToLogin} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Already a hunter?{' '}
              <Text style={styles.switchAccent}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: 'rgba(10, 8, 7, 0.70)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  handle: { backgroundColor: 'rgba(255,255,255,0.15)', width: 40 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diamond: { color: '#2f9e8f', fontSize: 14 },
  title: {
    color: '#fafaf9',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  line: { flex: 1, height: 1, backgroundColor: '#2f9e8f', marginLeft: 8 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  error: { color: '#ef4444', fontSize: 13 },
  input: {
    backgroundColor: '#1a1614',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fafaf9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2220',
  },
  switchLink: { alignItems: 'center' },
  switchText: { color: 'rgba(255,255,255,0.3)', fontSize: 13 },
  switchAccent: { color: '#2f9e8f' },
  createBtn: {
    backgroundColor: '#2f9e8f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  createText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
