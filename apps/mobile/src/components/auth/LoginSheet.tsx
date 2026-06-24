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
        setEmail('');
        setPassword('');
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

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.7}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['62%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>Hunter Login</Text>
            <View style={styles.headerLine} />
          </View>

          <Text style={styles.subtitle}>
            Sign in to save favorites and manage data.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Email"
            placeholderTextColor="#57534e"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            style={styles.input}
          />

          <BottomSheetTextInput
            placeholder="Password"
            placeholderTextColor="#57534e"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            style={styles.input}
          />

          <Pressable onPress={onSwitchToRegister} style={styles.switchLink}>
            <Text style={styles.switchText}>
              No account?{' '}
              <Text style={styles.switchAccent}>Register</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerDiamond: { color: '#2f9e8f', fontSize: 14 },
  headerTitle: { color: '#fafaf9', fontSize: 15, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  headerLine: { flex: 1, height: 1, backgroundColor: '#292524', marginLeft: 8 },
  subtitle: { color: '#a8a29e', fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 13 },
  input: {
    backgroundColor: '#0c0a09',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fafaf9',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#292524',
  },
  switchLink: { alignItems: 'center' },
  switchText: { color: '#57534e', fontSize: 13 },
  switchAccent: { color: '#2f9e8f' },
  button: {
    backgroundColor: '#2f9e8f',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
