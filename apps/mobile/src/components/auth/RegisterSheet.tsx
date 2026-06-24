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
          opacity={0.7}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['80%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1917' }}
        handleIndicatorStyle={{ backgroundColor: '#57534e' }}
        onDismiss={() => { setError(''); setUsername(''); setEmail(''); setPassword(''); setConfirm(''); }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>Hunter Register</Text>
            <View style={styles.headerLine} />
          </View>

          <Text style={styles.subtitle}>
            Create an account to save favorites and submit strategies.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BottomSheetTextInput
            placeholder="Username"
            placeholderTextColor="#57534e"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            returnKeyType="next"
            style={styles.input}
          />
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
            returnKeyType="next"
            style={styles.input}
          />
          <BottomSheetTextInput
            placeholder="Confirm Password"
            placeholderTextColor="#57534e"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            style={styles.input}
          />

          <Pressable onPress={onSwitchToLogin} style={styles.switchLink}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchAccent}>Sign in</Text>
            </Text>
          </Pressable>

          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 12 },
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
