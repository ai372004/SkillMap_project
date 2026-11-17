import mongoose from 'mongoose';

// One document per level test attempt.
const levelResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    track: { type: String, required: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    correctCount: Number,
    total: Number,
    weightedScore: Number,
    maxScore: Number,
    percent: Number,
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
    byDifficulty: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

levelResultSchema.index({ user: 1, track: 1, createdAt: -1 });

levelResultSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const LevelResult = mongoose.model('LevelResult', levelResultSchema);
