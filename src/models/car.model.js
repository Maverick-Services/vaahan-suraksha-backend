import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
    transmission: {
        type: String,
        enum: ["Automatic", "Manual"],
        default: "Manual"
    },
    fuel: {
        type: String,
        enum: ["Petrol", "Disel", "CNG"],
        default: "Petrol"
    },
    image: {
        type: String,
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand"
    },
    car_model: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CarModel"
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

export const Car = mongoose.model("Car", carSchema);