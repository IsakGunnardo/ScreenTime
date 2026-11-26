import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type CaptureResult = { uri: string } | { error: string } | null;

/**
 * Öppnar kameran (inte galleriet — bevis ska tas på plats), och krymper bilden
 * till max 1280 px bredd så uppladdning och AI-anrop blir snabba och billiga.
 */
export async function capturePhoto(): Promise<CaptureResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    return { error: 'Appen behöver få använda kameran. Slå på det i telefonens inställningar.' };
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1280) ctx.resize({ width: 1280 });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return { uri: saved.uri };
}
