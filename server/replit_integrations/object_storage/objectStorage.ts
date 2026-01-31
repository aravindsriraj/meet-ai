import { Client } from "@replit/object-storage";

const client = new Client();

export class ObjectStorageService {
  static async getPresignedUploadUrl(
    fileName: string,
    contentType: string
  ): Promise<{ uploadURL: string; objectPath: string; publicUrl: string }> {
    const objectPath = `public/avatars/${Date.now()}-${fileName}`;
    
    const { uploadUrl } = await client.uploadUrl(objectPath, {
      expiresIn: 900000, // 15 minutes in ms
    });

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;

    return { uploadURL: uploadUrl, objectPath, publicUrl };
  }

  static async uploadBuffer(
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ objectPath: string; publicUrl: string }> {
    const objectPath = `public/avatars/${Date.now()}-${fileName}`;
    
    await client.uploadFromBytes(objectPath, buffer);

    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const publicUrl = `https://storage.googleapis.com/${bucketId}/${objectPath}`;

    return { objectPath, publicUrl };
  }

  static async deleteFile(objectPath: string): Promise<void> {
    await client.delete(objectPath);
  }
}
