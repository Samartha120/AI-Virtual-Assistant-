const { supabase } = require('../config/supabase');
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

        // Upload to Supabase Storage in 'documents' bucket
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            return errorResponse(res, 500, 'Storage upload failed', error.message);
        }

        // Get public URL
        const { data: publicData } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);

        successResponse(res, 'File uploaded successfully', {
            path: data.path,
            url: publicData.publicUrl,
            originalName: file.originalname,
            mimeType: file.mimetype
        });

    } catch (err) {
        errorResponse(res, 500, 'File upload process failed', err.message);
    }
};

module.exports = {
    uploadFile
};
