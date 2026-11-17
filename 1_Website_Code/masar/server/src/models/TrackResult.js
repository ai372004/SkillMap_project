import mongoose from 'mongoose';

// One document per time a student takes the track quiz.
const trackResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    answers: { type: mongoose.Schema.Types.Mixed, required: true },
    scores: [
      {
        _id: false,
        track: String,
        raw: Number,
        max: Number,
        percent: Number,
        primaryPicks: Number,
      },
    ],
    recommendedTrack: { type: String, required: true },
    closeMatch: { type: Boolean, default: false },
  },
  { timestamps: true }
);

trackResultSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const TrackResult = mongoose.model('TrackResult', trackResultSchema);
