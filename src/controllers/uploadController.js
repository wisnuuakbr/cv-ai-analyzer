const uploadUseCase = require('../usecases/uploadUseCase');
const { asyncHandler } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

class UploadController {
    uploadDocuments = asyncHandler(async (req, res) => {
        logger.info('Upload request received');

        const result = await uploadUseCase.uploadDocuments(req.files);

        res.status(201).json({
            success: true,
            message: 'Documents uploaded successfully',
            data: result
        });
    });
}

module.exports = new UploadController();