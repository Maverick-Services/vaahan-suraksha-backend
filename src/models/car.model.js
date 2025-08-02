import mongoose from "mongoose";

const carSchema = new mongoose.Schema({

});

export const Car = mongoose.model("Car", carSchema);