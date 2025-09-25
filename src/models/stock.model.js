import mongoose from "mongoose";

const stockSchema = new mongoose.Schema({
    purchasePrice: {
        type: Number,
        // required: true,
    },
    sellingPrice: {
        type: Number,
        // required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    vendor: {
        type: String,
    },
    mechanicName: {
        type: String,
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    mechanic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
}, { timestamps: true });

export const Stock = mongoose.model('Stock', stockSchema);