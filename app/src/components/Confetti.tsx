import { useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

const PALETTE = [colors.primary, colors.mint, colors.sun, colors.coral, colors.sky];
const COUNT = 36;

/** Lättviktig konfetti med RN Animated. Hoppar över animationen om användaren valt reducerad rörelse. */
export function Confetti() {
  const { width, height } = Dimensions.get('window');
  const progress = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.25,
        rotate: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 360),
        size: 8 + Math.random() * 8,
        color: PALETTE[i % PALETTE.length],
        round: i % 3 === 0,
      })),
    [width],
  );

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      Animated.timing(progress, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              borderRadius: p.round ? p.size : 2,
              backgroundColor: p.color,
              opacity: t.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotate}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
