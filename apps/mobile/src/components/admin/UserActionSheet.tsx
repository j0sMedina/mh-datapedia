import { forwardRef, useCallback, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import type { AdminUser } from '../../hooks/useAdminUsers';

interface UserActionSheetProps {
  user: AdminUser | null;
  isMaster: boolean;
  onRoleChange: (userId: string, role: 'USER' | 'HELPER' | 'ADMIN') => void;
  onBanChange: (userId: string, banned: boolean, reason?: string) => void;
  isPending: boolean;
}

export const UserActionSheet = forwardRef<BottomSheetModal, UserActionSheetProps>(
  ({ user, isMaster, onRoleChange, onBanChange, isPending }, ref) => {
    const [banReason, setBanReason] = useState('');

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

    function handleDismiss() {
      setBanReason('');
    }

    const canBan = banReason.trim().length >= 10;

    // Role buttons depend on who is acting (isMaster) and the target's current role.
    // ADMIN can only move users within USER ↔ HELPER (API enforces ADMIN_MANAGEABLE_ROLES).
    // MASTER can move anyone to USER / HELPER / ADMIN (MASTER itself is excluded from the API schema).
    function getRoleButtons(u: AdminUser) {
      const buttons: { label: string; role: 'USER' | 'HELPER' | 'ADMIN'; style: 'primary' | 'secondary' }[] = [];

      if (isMaster) {
        if (u.role === 'USER') {
          buttons.push({ label: 'Promote to Helper', role: 'HELPER', style: 'primary' });
          buttons.push({ label: 'Promote to Admin', role: 'ADMIN', style: 'primary' });
        } else if (u.role === 'HELPER') {
          buttons.push({ label: 'Demote to Hunter', role: 'USER', style: 'secondary' });
          buttons.push({ label: 'Promote to Admin', role: 'ADMIN', style: 'primary' });
        } else if (u.role === 'ADMIN') {
          buttons.push({ label: 'Demote to Helper', role: 'HELPER', style: 'secondary' });
          buttons.push({ label: 'Demote to Hunter', role: 'USER', style: 'secondary' });
        }
      } else {
        // ADMIN: only USER ↔ HELPER
        if (u.role === 'USER') {
          buttons.push({ label: 'Promote to Helper', role: 'HELPER', style: 'primary' });
        } else if (u.role === 'HELPER') {
          buttons.push({ label: 'Demote to Hunter', role: 'USER', style: 'secondary' });
        }
      }

      return buttons;
    }

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['60%']}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: 'rgba(10,8,7,0.95)' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        onDismiss={handleDismiss}
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

              {/* Role actions */}
              {getRoleButtons(user).map((btn) => (
                <Pressable
                  key={btn.role}
                  onPress={() => onRoleChange(user.id, btn.role)}
                  disabled={isPending}
                  style={[
                    styles.button,
                    btn.style === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
                    isPending && { opacity: 0.5 },
                  ]}
                >
                  {isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.buttonText, btn.style === 'secondary' && styles.buttonTextSecondary]}>
                      {btn.label}
                    </Text>
                  )}
                </Pressable>
              ))}

              {/* Ban / Unban */}
              {user.banned ? (
                <Pressable
                  onPress={() => onBanChange(user.id, false)}
                  disabled={isPending}
                  style={[styles.button, styles.buttonUnban, isPending && { opacity: 0.5 }]}
                >
                  {isPending ? (
                    <ActivityIndicator color="#ef4444" />
                  ) : (
                    <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Unban User</Text>
                  )}
                </Pressable>
              ) : (
                <View style={styles.banSection}>
                  <BottomSheetTextInput
                    placeholder="Reason for ban (10 chars min)…"
                    placeholderTextColor="#57534e"
                    value={banReason}
                    onChangeText={setBanReason}
                    style={styles.reasonInput}
                    multiline
                    numberOfLines={2}
                  />
                  <Pressable
                    onPress={() => onBanChange(user.id, true, banReason.trim())}
                    disabled={isPending || !canBan}
                    style={[styles.button, styles.buttonBan, (isPending || !canBan) && { opacity: 0.4 }]}
                  >
                    {isPending ? (
                      <ActivityIndicator color="#ef4444" />
                    ) : (
                      <Text style={[styles.buttonText, styles.buttonTextDanger]}>Ban User</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 10 },
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
  username: { color: '#a8a29e', fontSize: 14, marginBottom: 2 },
  button: { borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#2f9e8f' },
  buttonSecondary: { backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#44403c' },
  buttonBan: { borderWidth: 1, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  buttonUnban: { borderWidth: 1, borderColor: '#44403c', backgroundColor: '#1c1917' },
  buttonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  buttonTextSecondary: { color: '#a8a29e' },
  buttonTextDanger: { color: '#ef4444' },
  banSection: { gap: 8 },
  reasonInput: {
    backgroundColor: '#1c1917',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#292524',
    color: '#fafaf9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: 'top',
  },
});
