// src/models/Hall.js
import mongoose from "mongoose";

const hallSchema = new mongoose.Schema({
  name: { type: String, required: true },
  theater: { type: mongoose.Schema.Types.ObjectId, ref: "Theater", required: true },
  capacity: { type: Number, required: true }
});

export default mongoose.model("Hall", hallSchema);
