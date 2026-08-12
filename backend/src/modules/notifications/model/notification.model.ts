import { Schema, model, Document, Types } from "mongoose";
import { User } from "../../user/model/User.model";

/**
 * Related entity embedded document — links a notification back to its source
 */
export interface INotificationRelatedEntity {
  entityType: string; // "exchange_request", "inventory", "medicine"
  entityId: Types.ObjectId;
}

/**
 * Delivery status per channel
 */
export interface INotificationDeliveryStatus {
  in_app: { sent: boolean; sentAt?: Date };
  email: { sent: boolean; sentAt?: Date; bounced: boolean };
  sms: { sent: boolean; sentAt?: Date };
}

/**
 * Interface for Notifications
 * Store user notifications for real-time / async updates
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId; // Reference to users
  type: string; // "exchange_request_received", "exchange_approved", "medicine_expiring_soon", etc.
  title: string;
  message: string;
  relatedEntity?: INotificationRelatedEntity;
  isRead: boolean;
  readAt?: Date;
  channels: ("in_app" | "email" | "sms")[];
  deliveryStatus: INotificationDeliveryStatus;
  expiresAt?: Date;
  createdAt: Date;
}

const relatedEntitySchema = new Schema<INotificationRelatedEntity>(
  {
    entityType: {
      type: String,
      required: [true, "Related entity type is required"],
      trim: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: [true, "Related entity id is required"],
    },
  },
  { _id: false }
);

const deliveryStatusSchema = new Schema<INotificationDeliveryStatus>(
  {
    in_app: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
    email: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      bounced: { type: Boolean, default: false },
    },
    sms: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
    },
  },
  { _id: false }
);

/**
 * Notification Schema
 * Store user notifications for real-time / async updates
 */
const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
      index: true,
      validate: {
        validator: async function (v: Types.ObjectId) {
          const user = await User.findById(v);
          return !!user;
        },
        message: "Recipient user not found",
      },
    },

    type: {
      type: String,
      required: [true, "Notification type is required"],
      trim: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title must not exceed 150 characters"],
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [1000, "Message must not exceed 1000 characters"],
    },

    relatedEntity: {
      type: relatedEntitySchema,
      required: false,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: Date,

    channels: {
      type: [String],
      enum: ["in_app", "email", "sms"],
      default: ["in_app"],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0;
        },
        message: "At least one delivery channel is required",
      },
    },

    deliveryStatus: {
      type: deliveryStatusSchema,
      default: () => ({
        in_app: { sent: false },
        email: { sent: false, bounced: false },
        sms: { sent: false },
      }),
    },

    expiresAt: {
      type: Date,
      description: "TTL — auto-delete old notifications",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

/**
 * Indexes
 */
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ type: 1 });

// TTL index — auto-delete once expiresAt passes (only applies to docs that set it)
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Pre-save hook: stamp readAt when isRead flips true
 */
notificationSchema.pre("save", function (next) {
  if (this.isModified("isRead") && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

/**
 * Static method: Find unread notifications for a user
 */
notificationSchema.statics.findUnreadForUser = function (userId: Types.ObjectId) {
  return this.find({ recipient: userId, isRead: false }).sort({ createdAt: -1 });
};

/**
 * Instance method: Mark as read
 */
notificationSchema.methods.markAsRead = async function (): Promise<void> {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

/**
 * Notification Model
 */
export const Notification = model<INotification>("Notification", notificationSchema);
