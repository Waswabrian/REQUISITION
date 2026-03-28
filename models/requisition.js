const mongoose = require('mongoose');

const RequisitionSchema = new mongoose.Schema({
    // Staff Submission Data
    requestDate: { type: Date, default: Date.now },
    department: String,
    items: [{
        sn: Number,
        budgetLine: String,
        costCentre: String,
        description: String,
        qty: Number,
        unit: Number,
        total: Number
    }],
    attachmentPath: String,

    // Workflow Status
    status: { 
        type: String, 
        enum: ['PENDING_HOD', 'PENDING_FINANCE', 'PENDING_DIRECTOR', 'APPROVED', 'REJECTED'],
        default: 'PENDING_HOD' 
    },

    // Signatures (Stored as Base64 strings)
    staffName: String,
    hodSignature: String,
    financeSignature: String,
    directorSignature: String,

    // Audit Trail
    history: [{
        stage: String,
        user: String,
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Requisition', RequisitionSchema);