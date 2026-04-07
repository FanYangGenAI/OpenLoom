import { randomUUID } from 'crypto';
import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import type { FaceEntry } from './types.js';

export interface FaceDetectionResult {
  faces: FaceEntry[];
  skipped: boolean;   // true when TF / face-api is not available
  error?: string;
}

/**
 * Detect faces in an image, crop each face, and save crops to .openloom/faces/.
 *
 * Uses @vladmandic/face-api with @tensorflow/tfjs-node for detection,
 * and sharp for cropping.
 *
 * Gracefully skips (returns empty faces[]) if TensorFlow native bindings
 * are not installed — the rest of the ImageAgent pipeline continues normally.
 *
 * To enable face detection, install the native TF bindings:
 *   npm install @tensorflow/tfjs-node @vladmandic/face-api
 */
export async function detectFaces(
  imagePath: string,
  openloomDir: string,
): Promise<FaceDetectionResult> {
  // Dynamic import so missing packages don't crash the whole module
  let faceapi: typeof import('@vladmandic/face-api');
  let tf: typeof import('@tensorflow/tfjs-node');
  let sharp: typeof import('sharp');

  try {
    [faceapi, tf, sharp] = await Promise.all([
      import('@vladmandic/face-api'),
      import('@tensorflow/tfjs-node'),
      import('sharp'),
    ]);
  } catch {
    return { faces: [], skipped: true, error: 'face-api or tfjs-node not installed' };
  }

  try {
    // Load models from @vladmandic/face-api bundled model weights
    const modelPath = join(
      new URL('../../..', import.meta.url).pathname,
      'node_modules/@vladmandic/face-api/model',
    );

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
    ]);

    // Load image into a tensor via sharp → raw pixel buffer
    const sharpInstance = sharp.default(imagePath);
    const metadata = await sharpInstance.metadata();
    const { data, info } = await sharpInstance
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3]);
    const detections = await faceapi.detectAllFaces(
      tensor as never,
      new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }),
    );
    tensor.dispose();

    if (detections.length === 0) {
      return { faces: [], skipped: false };
    }

    // Save face crops
    const facesDir = join(openloomDir, 'faces');
    await mkdir(facesDir, { recursive: true });

    const faces: FaceEntry[] = await Promise.all(
      detections.map(async (det) => {
        const { x, y, width, height } = det.box;
        const faceId = `face_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
        const cropPath = join(facesDir, `${faceId}.jpg`);

        // Add padding around the bounding box (20%)
        const padX = Math.round(width * 0.2);
        const padY = Math.round(height * 0.2);
        const left   = Math.max(0, Math.round(x) - padX);
        const top    = Math.max(0, Math.round(y) - padY);
        const right  = Math.min(info.width,  Math.round(x + width)  + padX);
        const bottom = Math.min(info.height, Math.round(y + height) + padY);

        await sharp.default(imagePath)
          .extract({ left, top, width: right - left, height: bottom - top })
          .jpeg({ quality: 90 })
          .toFile(cropPath);

        return {
          face_id: faceId,
          crop_path: cropPath,
          bbox: [Math.round(x), Math.round(y), Math.round(width), Math.round(height)] as [number, number, number, number],
          matched_person: null,
        };
      }),
    );

    return { faces, skipped: false };
  } catch (err) {
    return { faces: [], skipped: true, error: (err as Error).message };
  }
}
