import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.inkSoft}
        style={styles.input}
        accessibilityLabel={label}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityLiveRegion="assertive">
      <Text style={styles.errorText}>⚠️ {message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  input: {
    minHeight: 54, borderWidth: 2, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: space(4), fontFamily: fonts.body, fontSize: 17, color: colors.ink,
    backgroundColor: colors.surface,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  error: { backgroundColor: colors.coralSoft, padding: space(3), borderRadius: radius.md },
  errorText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.coralDeep },
});
