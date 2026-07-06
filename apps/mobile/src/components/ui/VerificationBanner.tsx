import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';

interface Props {
  email?: string;
}

export function VerificationBanner({ email }: Props) {
  function openMail() {
    Linking.openURL('mailto:').catch(() => {});
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Verify your email to unlock all features.
      </Text>
      <TouchableOpacity onPress={openMail}>
        <Text style={styles.link}>Open mail app</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#78350f',
    borderBottomWidth: 1,
    borderBottomColor: '#92400e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  text: {
    color: '#fde68a',
    fontSize: 12,
    flex: 1,
  },
  link: {
    color: '#fef3c7',
    fontSize: 12,
    textDecorationLine: 'underline',
    flexShrink: 0,
  },
});
