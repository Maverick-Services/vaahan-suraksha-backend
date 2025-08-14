import mongoose from "mongoose";


export const itemsSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    name: {
        type: String,
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    price: {
        type: Number,
        required: true
    }
}, { _id: false }, { timestamps: true });

const riderInventorySchema = new mongoose.Schema({
    riderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    items: [itemsSchema],
});

export const RiderInventory = mongoose.model("RiderInventory", riderInventorySchema);