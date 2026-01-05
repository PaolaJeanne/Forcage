// src/middlewares/validation.middleware.js
exports.validateUserId = (req, res, next) => {
    const { userId } = req.params;

    if (!userId || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        return res.status(400).json({
            success: false,
            message: 'ID utilisateur invalide'
        });
    }

    next();
};

exports.validateAgencyId = (req, res, next) => {
    const { agencyId } = req.params;

    if (!agencyId || !/^[0-9a-fA-F]{24}$/.test(agencyId)) {
        return res.status(400).json({
            success: false,
            message: 'ID agence invalide'
        });
    }

    next();
};
