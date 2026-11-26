import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '@/theme';

export function Screen({
  children,
  back,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  back?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Tillbaka"
          hitSlop={12}
        >
          <Text style={styles.backText}>‹ Tillbaka</Text>
        </Pressable>
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer ? <SafeAreaView edges={['bottom']} style={styles.footer}>{footer}</SafeAreaView> : null}
    </SafeAreaView>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.error}>
      <Text style={{ fontSize: 44 }}>🔌</Text>
      <Text style={styles.errorTitle}>Får ingen kontakt med servern</Text>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retry}>Försök igen</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  back: { paddingHorizontal: space(5), paddingTop: space(2), paddingBottom: space(1), alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.primary },
  content: { padding: space(5), paddingBottom: space(10), gap: space(4) },
  footer: { paddingHorizontal: space(5), paddingTop: space(3), backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line, gap: space(3) },
  error: { alignItems: 'center', gap: space(2), paddingVertical: space(10) },
  errorTitle: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink },
  errorText: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  retry: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.primary, padding: space(2) },
});
