import { forwardRef, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { AdminUser } from '../../hooks/useAdminUsers';

interface UserActionSheetProps {
  user: AdminUser | null;
  onRoleChange: (userId: string, role: 'USER' | 'ADMIN') => void;
  onBanChange: (userId: string, banned: boolean) => void;
  isPending: boolean;
}

export const UserActionSheet = forwardRef<BottomSheetModal, UserActionSheetProps>(
  ({ user, onRoleChange, onBanChange, isPending }, ref) => {
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
        snapPoints={['38%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: 'rgba(10,8,7,0.95)' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDiamond}>◆</Text>
            <Text style={styles.headerTitle}>User Actions</Text>
            <View style={styles.headerLine} />
          </View>

          {user && (
            <>
              <Text style={styles.username}>@{user.username}</Text>

              {/* Role action */}
              <Pressable
                onPress={() => onRoleChange(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')}
                disabled={isPending}
                style={[
                  styles.button,
                  user.role === 'ADMIN' ? styles.buttonSecondary : styles.buttonPrimary,
                  isPending && { opacity: 0.5 },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.buttonText, user.role === 'ADMIN' && styles.buttonTextSecondary]}>
                    {user.role === 'ADMIN' ? 'Revoke Admin' : 'Promote to Admin'}
                  </Text>
                )}
              </Pressable>

              {/* Ban action */}
              <Pressable
                onPress={() => onBanChange(user.id, !user.banned)}
                disabled={isPending}
                style={[
                  styles.button,
                  user.banned ? styles.buttonUnban : styles.buttonBan,
                  isPending && { opacity: 0.5 },
                ]}
              >
                {isPending ? (
                  <ActivityIndicator color="#ef4444" />
                ) : (
                  <Text style={[styles.buttonText, user.banned ? styles.buttonTextSecondary : styles.buttonTextDanger]}>
                    {user.banned ? 'Unban User' : 'Ban User'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerDiamond: { color: '#2f9e8f', fontSize: 13 },
  headerTitle: {
    color: '#fafaf9',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerLine: { flex: 1, height: 1, backgroundColor: '#2f9e8f', opacity: 0.35 },
  username: { color: '#a8a29e', fontSize: 14, marginBottom: 4 },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2f9e8f' },
  buttonSecondary: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#44403c' },
  buttonBan: { borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  buttonUnban: { borderWidth: 1, borderColor: '#44403c', backgroundColor: '#1c1917' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  buttonTextSecondary: { color: '#a8a29e' },
  buttonTextDanger: { color: '#ef4444' },
});
