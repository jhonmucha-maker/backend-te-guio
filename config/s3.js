const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.us-east-1.wasabisys.com',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || 'marketplace-uploads';

// Subir archivo a S3 (con timeout de 30s para evitar que cuelgue)
const uploadToS3 = async (key, body, contentType) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    }), { abortSignal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  // Retorna URL relativa al proxy del backend (la cuenta Wasabi bloquea acceso publico directo)
  return `/api/catalog/files/${key}`;
};

// Obtener archivo de S3
const getFromS3 = async (key) => {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return response;
};

// Eliminar archivo de S3
const deleteFromS3 = async (key) => {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
};

// Eliminar multiples archivos
const deleteManyFromS3 = async (keys) => {
  await Promise.all(keys.map(key => deleteFromS3(key)));
};

// Generar la key (ruta) del archivo en S3
const buildS3Key = (subDir, filename) => {
  return `${subDir}/${filename}`;
};

module.exports = { s3Client, BUCKET, uploadToS3, getFromS3, deleteFromS3, deleteManyFromS3, buildS3Key };
