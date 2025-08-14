import mongoose from "mongoose";

const carModelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Service name is required"],
        unique: [true, "Service name already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    image: {
        type: String,
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand"
    },
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    }]
});

export const CarModel = mongoose.model("CarModel", carModelSchema);