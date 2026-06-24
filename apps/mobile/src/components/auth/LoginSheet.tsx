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

interface LoginSheetProps {
  onSwitchToRegister: () => void;
}

export const LoginSheet = forwardRef<BottomSheetModal, LoginSheetProps>(
  ({ onSwitchToRegister }, ref) => {
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
        (ref as React.RefObject<BottomSheetModal>).current?.dismiss();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setError('Invalid email or password.');
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
        snapPoints={['52%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
        onDismiss={() => { setError(''); setEmail(''); setPassword(''); }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.diamond}>◆</Text>
            <Text style={styles.title}>Hunter Login</Text>
            <View style={styles.line} />
          </View>

          <Text style={styles.subtitle}>Sign in to save favorites and manage data.</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Spacer pushes inputs lower, matching where demo buttons were */}
          <View style={styles.fieldsSpacer}>
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
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              style={[styles.input, { marginTop: 12 }]}
            />
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.signInBtn, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInText}>Sign In</Text>
            )}
          </Pressable>

          <Pressable onPress={onSwitchToRegister} style={styles.registerLink}>
            <Text style={styles.registerText}>
              No account?{' '}
              <Text style={styles.registerAccent}>Register</Text>
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
  handle: { backgroundColor: 'rgba(255,255,255,0.18)', width: 40 },
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
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginLeft: 8 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  error: { color: '#ef4444', fontSize: 12 },
  fieldsSpacer: { marginTop: 10 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fafaf9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  signInBtn: {
    backgroundColor: '#2f9e8f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  signInText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  registerLink: { alignItems: 'center', paddingVertical: 4 },
  registerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
  registerAccent: { color: '#2f9e8f' },
});
