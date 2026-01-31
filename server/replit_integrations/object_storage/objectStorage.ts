import { Storage } from "@google-cloud/storage";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
const storage = new Storage();
const bucket = bucketId ? storage.bucket(bucketId) : null;

export class ObjectStorageService {
  private static getBucket() {
    if (!bucket) {
      throw new Error("Object storage not configured - missing DEFAULT_OBJECT_STORAGE_BUCKET_ID");
    }
    return bucket;
  }

  static async getPresignedUploadUrl(
    fileName: string,
    contentType: string
  ): Promise<{ uploadURL: string; objectPath: string; publicUrl: string }> {
    const bkt = this.getBucket();
    const objectPath = `public/avatars/${Date.now()}-${fileName}`;
    const file = bkt.file(objectPath);

    const [uploadURL] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;

    return { uploadURL, objectPath, publicUrl };
  }

  static async uploadBuffer(
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ objectPath: string; publicUrl: string }> {
    const bkt = this.getBucket();
    const objectPath = `public/avatars/${Date.now()}-${fileName}`;
    const file = bkt.file(objectPath);

    await file.save(buffer, {
      contentType,
      public: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;

    return { objectPath, publicUrl };
  }

  static async deleteFile(objectPath: string): Promise<void> {
    const bkt = this.getBucket();
    const file = bkt.file(objectPath);
    await file.delete({ ignoreNotFound: true });
  }
}
