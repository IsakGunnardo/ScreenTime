// Designtokens för ScreenTime. All färg, typografi och form går via den här filen.

export const colors = {
  bg: '#FFF7EC',          // varm gräddvit
  surface: '#FFFFFF',
  surfaceMuted: '#FBEFDF',
  ink: '#2B2238',         // nästan svart, lila ton
  inkSoft: '#6E6480',
  line: '#EADFCE',

  primary: '#6C4BF4',     // lila — huvudknappar
  primaryDeep: '#4F31CF',
  primarySoft: '#ECE6FF',

  mint: '#2FC28C',
  mintDeep: '#1F9A6D',
  mintSoft: '#DDF7EC',

  sun: '#FFC233',         // mynt
  sunDeep: '#E0A10E',
  sunSoft: '#FFF1CC',

  coral: '#FF7A59',       // streak / värme
  coralDeep: '#E25A38',
  coralSoft: '#FFE5DC',

  sky: '#3BA7FF',         // skärmtid
  skySoft: '#DDEFFF',
};

export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
};

export const radius = { sm: 12, md: 18, lg: 26, pill: 999 };
export const space = (n: number) => n * 4;

/** "Chunky" skugga under kort och knappar — ger taktil, lekfull känsla. */
export const chunky = (color: string, depth = 4) => ({
  borderBottomWidth: depth,
  borderBottomColor: color,
});
