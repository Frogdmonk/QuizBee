import { getTeacherClient } from '@/lib/supabase';
import { newKey } from '@/lib/quiz-rules';
import { prepareImage } from '@/utils/image';

export const QUIZ_MEDIA_BUCKET = 'quiz-media';

/**
 * Compresses and uploads an image into the teacher's own folder of the
 * quiz-media bucket. Returns the storage path to store on the quiz.
 * Storage RLS enforces the "<user id>/" folder server-side.
 */
export async function uploadQuizImage(file: File, userId: string): Promise<string> {
  const prepared = await prepareImage(file);
  const path = `${userId}/${newKey()}.${prepared.extension}`;
  const { error } = await getTeacherClient()
    .storage.from(QUIZ_MEDIA_BUCKET)
    .upload(path, prepared.blob, {
      contentType: prepared.blob.type || `image/${prepared.extension === 'jpg' ? 'jpeg' : prepared.extension}`,
      cacheControl: '31536000',
      upsert: false,
    });
  if (error) throw error;
  return path;
}
