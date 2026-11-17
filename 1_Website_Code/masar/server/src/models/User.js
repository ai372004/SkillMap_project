import mongoose from 'mongoose';
import { TRACK_IDS } from '../content/index.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    university: { type: String, trim: true, maxlength: 120 },
    academicYear: { type: String, trim: true, maxlength: 40 },
    recommendedTrack: { type: String, enum: [...TRACK_IDS, null], default: null },
    chosenTrack: { type: String, enum: [...TRACK_IDS, null], default: null },
    // Raised whenever the password changes, so older login tokens stop working.
    tokenVersion: { type: Number, default: 0, select: false },
    // Set when a supervisor resets the password; cleared when the student picks a new one.
    mustChangePassword: { type: Boolean, default: false },
    // When the account was last used (refreshed at most once an hour), so the
    // supervisor can see who has gone quiet.
    lastSeenAt: { type: Date, default: null },
    // Plan steps the student ticked off, as "track:level:stepId", so each plan keeps its own list.
    planDone: { type: [String], default: [] },
  },
  { timestamps: true }
);

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.passwordHash;
    delete ret.tokenVersion;
    delete ret.planDone;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
