import mongoose from "mongoose";

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const PollSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    options: [OptionSchema],
    status: {
      type: String,
      enum: ["active", "closed"],
      default: "active",
    },
    code: { type: String, unique: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

export const Poll = mongoose.model("Poll", PollSchema);