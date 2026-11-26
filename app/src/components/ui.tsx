import * as Haptics from 'expo-haptics';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { chunky, colors, fonts, radius, space } from '@/theme';

type Variant = 'primary' | 'mint' | 'ghost' | 'danger';

const variants: Record<Variant, { bg: string; edge: string; fg: string }> = {
  primary: { bg: colors.primary, edge: colors.primaryDeep, fg: '#fff' },
  mint: { bg: colors.mint, edge: colors.mintDeep, fg: '#fff' },
  ghost: { bg: colors.surface, edge: colors.line, fg: colors.ink },
  danger: { bg: colors.surface, edge: colors.coralSoft, fg: colors.coralDeep },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const v = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, ...chunky(v.edge, pressed ? 1 : 5) },
        pressed && { transform: [{ translateY: 4 }] },
        variant === 'ghost' && { borderWidth: 2, borderColor: colors.line },
        variant === 'danger' && { borderWidth: 2, borderColor: colors.coralSoft },
        inactive && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.btnText, { color: v.fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ icon, value, label, bg, fg }: { icon: string; value: string | number; label?: string; bg: string; fg: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessibilityLabel={`${value} ${label ?? ''}`}>
      <Text style={styles.pillIcon}>{icon}</Text>
      <Text style={[styles.pillValue, { color: fg }]}>{value}</Text>
      {label ? <Text style={[styles.pillLabel, { color: fg }]}>{label}</Text> : null}
    </View>
  );
}

export function RewardChips({ minutes, xp, coins }: { minutes: number; xp: number; coins: number }) {
  return (
    <View style={styles.chips}>
      <Pill icon="⏱️" value={`+${minutes}`} label="min" bg={colors.skySoft} fg={colors.ink} />
      <Pill icon="⭐" value={`+${xp}`} label="XP" bg={colors.primarySoft} fg={colors.ink} />
      <Pill icon="🪙" value={`+${coins}`} bg={colors.sunSoft} fg={colors.ink} />
    </View>
  );
}

export function ProgressBar({ value, max, color = colors.primary }: { value: number; max: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: value }}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 58,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(5),
  },
  btnText: { fontFamily: fonts.displayBold, fontSize: 19, letterSpacing: 0.3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(4),
    borderWidth: 2,
    borderColor: colors.line,
    ...chunky(colors.line, 5),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  pillIcon: { fontSize: 15 },
  pillValue: { fontFamily: fonts.bodyBold, fontSize: 15 },
  pillLabel: { fontFamily: fonts.body, fontSize: 13, opacity: 0.75 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  track: { height: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  h1: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, lineHeight: 23 },
});
