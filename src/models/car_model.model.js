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
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand"
    }
});

export const CarModel = mongoose.model("CarModel", carModelSchema);