const multer = require('multer');
const { UPLOAD } = require('../config/constants');
const { uploadToS3, buildS3Key } = require('../config/s3');

// Memory storage: archivos se mantienen en buffer, luego se suben a S3
const memStorage = multer.memoryStorage();

const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

const uploadImages = multer({
  storage: memStorage,
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD.ALLOWED_IMAGE_TYPES),
});

const uploadStoreImages = multer({
  storage: memStorage,
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD.ALLOWED_IMAGE_TYPES),
});

const uploadDocs = multer({
  storage: memStorage,
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
});

const uploadGalleryImages = multer({
  storage: memStorage,
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD.ALLOWED_IMAGE_TYPES),
});

const uploadSubscription = multer({
  storage: memStorage,
  limits: { fileSize: UPLOAD.MAX_SIZE_BYTES },
  fileFilter: fileFilter(UPLOAD.ALLOWED_RECEIPT_TYPES),
});

// Sube los archivos de req.files a S3 y agrega s3Url a cada file
async function uploadFilesToS3(req, res, next) {
  if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) return next();

  try {
    // req.files puede ser un array o un objeto { fieldname: [files] }
    const fileList = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files).flat();

    for (const file of fileList) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = file.originalname.substring(file.originalname.lastIndexOf('.'));
      const filename = `${file.fieldname}-${uniqueSuffix}${ext}`;
      const subDir = file._s3SubDir || 'general';
      const key = buildS3Key(subDir, filename);

      const s3Url = await uploadToS3(key, file.buffer, file.mimetype);
      file.s3Url = s3Url;
      file.s3Key = key;
      file.filename = filename;
    }

    next();
  } catch (error) {
    console.error('Error uploading files to S3:', error.message || error);
    return res.status(500).json({ error: 'Error al subir archivos. Intenta de nuevo.' });
  }
}

// Middleware que asigna el subdirectorio de S3 segun el contexto
function setS3SubDir(subDir) {
  return (req, res, next) => {
    // Se ejecuta DESPUES de multer, antes de uploadFilesToS3
    const fileList = Array.isArray(req.files)
      ? req.files
      : req.files ? Object.values(req.files).flat() : [];

    for (const file of fileList) {
      file._s3SubDir = typeof subDir === 'function' ? subDir(req, file) : subDir;
    }
    next();
  };
}

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'El archivo excede el limite de 10MB' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Maximo 5 fotos por entidad' });
    }
    return res.status(400).json({ error: `Error de upload: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
}

module.exports = {
  uploadImages, uploadStoreImages, uploadDocs, uploadGalleryImages, uploadSubscription,
  uploadFilesToS3, setS3SubDir, handleMulterError,
};
