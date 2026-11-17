import mongoose from 'mongoose';

export const SUBMISSION_STATUSES = ['pending', 'approved', 'needs_revision'];

// A student's work for one task. Resubmitting replaces the link and
// sends it back to "pending" for review.
const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    track: { type: String, required: true },
    taskId: { type: String, required: true },
    level: { type: String, required: true },
    link: { type: String, required: true, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    status: { type: String, enum: SUBMISSION_STATUSES, default: 'pending' },
    feedback: { type: String, trim: true, maxlength: 1000, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    // False from the moment the supervisor replies until the student opens their tasks.
    seenByStudent: { type: Boolean, default: true },
  },
  { timestamps: true }
);

submissionSchema.index({ user: 1, taskId: 1 }, { unique: true });
submissionSchema.index({ status: 1, updatedAt: -1 });
submissionSchema.index({ user: 1, seenByStudent: 1 });

submissionSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Submission = mongoose.model('Submission', submissionSchema);
