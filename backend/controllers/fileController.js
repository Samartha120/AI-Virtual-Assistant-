const crypto = require('crypto');
const { adminBucket } = require('../config/firebaseAdmin');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, 'No file uploaded');
        }

        const userId = req.user.id;
        const file = req.file;
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const downloadToken = crypto.randomUUID();
        const gcsFile = adminBucket.file(fileName);

        await gcsFile.save(file.buffer, {
            resumable: false,
            contentType: file.mimetype,
            metadata: {
                metadata: {
                    firebaseStorageDownloadTokens: downloadToken,
                },
            },
        });

        // Return a signed URL (works without making the object public)
        const [signedUrl] = await gcsFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        successResponse(res, 'File uploaded successfully', {
            path: fileName,
            url: signedUrl,
            originalName: file.originalname,
            mimeType: file.mimetype,
        });

    } catch (err) {
        errorResponse(res, 500, 'File upload process failed', err.message);
    }
};

module.exports = {
    uploadFile
};
