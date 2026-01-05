/**
 * src/services/admin.service.js
 * Backend service for administrative operations
 */
const User = require('../models/User');
const Agency = require('../models/Agency');
const logger = require('../utils/logger');

/**
 * Export users in specified format
 */
const exportUsers = async (format, includeInactive = false) => {
    try {
        const query = includeInactive ? {} : { isActive: true };
        const users = await User.find(query).populate('agence');

        if (format === 'csv') {
            // Basic CSV generation
            const header = 'ID,Email,Role,Agency,Status\n';
            const rows = users.map(u =>
                `${u._id},${u.email},${u.role},${u.agence ? u.agence : 'N/A'},${u.isActive ? 'Active' : 'Inactive'}`
            ).join('\n');
            return { success: true, data: header + rows };
        }

        // Default to a structured object that the route can handle
        return { success: true, data: users };
    } catch (error) {
        logger.error('Error in exportUsers service:', error);
        return { success: false, message: error.message };
    }
};

/**
 * Bulk create users
 */
const bulkCreateUsers = async (usersData, adminId) => {
    try {
        logger.info(`Bulk creating ${usersData.length} users by admin ${adminId}`);
        // Implementation would involve validation and batch insert
        const results = await User.insertMany(usersData.map(u => ({ ...u, createdBy: adminId })), { ordered: false });
        return { success: true, count: results.length, data: results };
    } catch (error) {
        logger.error('Error in bulkCreateUsers service:', error);
        return { success: false, message: error.message };
    }
};

module.exports = {
    exportUsers,
    bulkCreateUsers
};
