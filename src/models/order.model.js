import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    type: {
        type: String,
        enum: ["oneTime", "monthly"],
        default: "oneTime"
    },


    /****************  PAYMENT FIELDS  *****************/
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paymentStatus: {
        type: String,
        enum: ["Paid", "Pending"],
        default: "Pending"
    },

    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

export const Order = mongoose.model("Order", orderSchema);