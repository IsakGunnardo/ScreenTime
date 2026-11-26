import { StyleSheet, Text, View } from 'react-native';
import type { AiVerdict } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

/** Visar AI:ns rådgivande bedömning. audience styr om barnets eller förälderns text visas. */
export function AiVerdictCard({ ai, audience }: { ai?: AiVerdict; audience: 'child' | 'parent' }) {
  if (!ai) {
    if (audience === 'child') return null;
    return (
      <View style={[styles.box, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={styles.icon}>🤖</Text>
        <View style={styles.textCol}>
          <Text style={styles.title}>Ingen AI-bedömning</Text>
          <Text style={styles.text}>Titta på bilden själv.</Text>
        </View>
      </View>
    );
  }

  const ok = ai.complete;
  const bg = ok ? colors.mintSoft : colors.sunSoft;
  const title = audience === 'child'
    ? ok ? 'Robo-koll: ser toppen ut!' : 'Robo-koll: nästan där!'
    : ok ? `AI: ser klart ut (${Math.round(ai.confidence * 100)} %)` : `AI: tveksam (${Math.round(ai.confidence * 100)} %)`;
  const text = audience === 'child' ? ai.feedbackChild : ai.feedbackParent;

  return (
    <View style={[styles.box, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
      <Text style={styles.icon}>{ok ? '🤖✅' : '🤖💡'}</Text>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {text ? <Text style={styles.text}>{text}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' },
  icon: { fontSize: 26 },
  textCol: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, lineHeight: 21 },
});
