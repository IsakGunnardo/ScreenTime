import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { chunky, colors, fonts, radius, space } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Stora sifferknappar för barn. Anropar onComplete när 4 siffror är inmatade. */
export function PinPad({
  value,
  onChange,
  onComplete,
  busy,
  color = colors.primary,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (pin: string) => void;
  busy?: boolean;
  color?: string;
}) {
  useEffect(() => {
    if (value.length === 4) onComplete(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const press = (k: string) => {
    if (busy) return;
    Haptics.selectionAsync().catch(() => {});
    if (k === '⌫') onChange(value.slice(0, -1));
    else if (k && value.length < 4) onChange(value + k);
  };

  return (
    <View style={{ gap: space(6), alignItems: 'center' }}>
      <View style={styles.dots} accessibilityLabel={`${value.length} av 4 siffror`}>
        {busy ? (
          <ActivityIndicator color={color} />
        ) : (
          [0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i < value.length && { backgroundColor: color, borderColor: color }]} />
          ))
        )}
      </View>
      <View style={styles.grid}>
        {KEYS.map((k, i) =>
          k ? (
            <Pressable
              key={i}
              onPress={() => press(k)}
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? 'Radera' : k}
              style={({ pressed }) => [
                styles.key,
                pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 1 },
              ]}
            >
              <Text style={styles.keyText}>{k}</Text>
            </Pressable>
          ) : (
            <View key={i} style={styles.keyEmpty} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: space(4), height: 24, alignItems: 'center' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: colors.line },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 84 + 2 * 14, gap: 14 },
  key: {
    width: 84, height: 70, borderRadius: radius.md, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.line,
    ...chunky(colors.line, 4),
  },
  keyEmpty: { width: 84, height: 70 },
  keyText: { fontFamily: fonts.displayBold, fontSize: 28, color: colors.ink },
});
