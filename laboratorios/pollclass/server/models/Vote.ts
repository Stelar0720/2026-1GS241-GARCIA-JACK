import mongoose from "mongoose";

const VoteSchema = new mongoose.Schema(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
      required: true,
    },
    optionIndex: { type: Number, required: true },
    voterName: { type: String, required: true },
  },
  { timestamps: true }
);

// Evita votos duplicados por encuesta + nombre
VoteSchema.index({ pollId: 1, voterName: 1 }, { unique: true });

export const Vote = mongoose.model("Vote", VoteSchema);