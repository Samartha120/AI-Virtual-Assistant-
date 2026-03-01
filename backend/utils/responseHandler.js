const successResponse = (res, message, data = {}) => {
    return res.status(200).json({
        success: true,
        message,
        data
    });
};

const errorResponse = (res, statusCode, message, error = null) => {
    const response = {
        success: false,
        message
    };

    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    successResponse,
    errorResponse
};
