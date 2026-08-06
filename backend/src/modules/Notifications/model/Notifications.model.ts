import { Schema, model, Document, Types } from "mongoose";
import { User } from "../../user/model/User.model";

/**
 * Related entity interface for notifications
 */
export interface IRelatedEntity {
  entityType: "exchange_request" | "inventory" | "medicine" | "hospital" | "user";
  entityId: Types.ObjectId;
}

/**
 * Delivery status interface
 */
export interface IDeliveryStatus {
  in_app?: { sent: boolean; sentAt?: Date };
  email?: { sent: boolean; sentAt?: Date; bounced?: boolean };
  sms?: { sent: boolean; sentAt?: Date };
}

/**
 * Interface for Notifications
 * Store user notifications for real-time updates
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId; // Reference to users
  type:
    | "exchange_request_received"
    | "exchange_approved"
    | "exchange_rejected"
    | "exchange_completed"
    | "medicine_expiring_soon"
    | "low_stock_alert"
    | "exchange_request_sent"
    | "inventory_updated"
    | "hospital_verified"
    | "system_alert";
  title: string;
  message: string;
  relatedEntity: IRelatedEntity;
  isRead: boolean;
  readAt?: Date;
  channels: ("in_app" | "email" | "sms")[];
  deliveryStatus: IDeliveryStatus;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Related Entity Schema
 */
const relatedEntitySchema = new Schema<IRelatedEntity>(
  {
    entityType: {
      type: String,
      required: true,
      enum: ["exchange_request", "inventory", "medicine", "hospital", "user"],
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Delivery Status Schema
 */
const deliveryStatusSchema = new Schema<IDeliveryStatus>(
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
 * Store user notifications for real-time updates
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
        message: "User not found",
      },
    },

    type: {
      type: String,
      required: [true, "Notification type is required"],
      enum: [
        "exchange_request_received",
        "exchange_approved",
        "exchange_rejected",
        "exchange_completed",
        "medicine_expiring_soon",
        "low_stock_alert",
        "exchange_request_sent",
        "inventory_updated",
        "hospital_verified",
        "system_alert",
      ],
      index: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [200, "Title must not exceed 200 characters"],
      trim: true,
    },

    message: {
      type: String,
      required: [true, "Message is required"],
      minlength: [10, "Message must be at least 10 characters"],
      maxlength: [1000, "Message must not exceed 1000 characters"],
      trim: true,
    },

    relatedEntity: {
      type: relatedEntitySchema,
      required: [true, "Related entity is required"],
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
      validate: {
        validator: function (v?: Date) {
          if (!v) return true;
          return this.isRead;
        },
        message: "Read date can only be set when isRead is true",
      },
    },

    channels: {
      type: [String],
      enum: ["in_app", "email", "sms"],
      default: ["in_app"],
      validate: {
        validator: function (v: string[]) {
          return v.length > 0 && v.length <= 3;
        },
        message: "At least one delivery channel required",
      },
    },

    deliveryStatus: {
      type: deliveryStatusSchema,
      default: () => ({}),
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiry date is required"],
      index: { expireAfterSeconds: 0 }, // TTL index for auto-delete
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Indexes
 */
// Compound indexes for common queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ recipient: 1 });
notificationSchema.index({ type: 1 });

// TTL index for auto-cleanup
notificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

/**
 * Pre-save hook: Set default expiry (30 days)
 */
notificationSchema.pre("save", function (next) {
  if (!this.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.expiresAt = expiryDate;
  }

  // Set readAt if marking as read
  if (this.isModified("isRead") && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }

  next();
});

/**
 * Static method: Create notification
 */
notificationSchema.statics.createNotification = async function (data: {
  recipient: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedEntity: IRelatedEntity;
  channels?: string[];
  expiresAt?: Date;
}): Promise<INotification> {
  return this.create({
    ...data,
    channels: data.channels || ["in_app"],
  });
};

/**
 * Static method: Find unread notifications for user
 */
notificationSchema.statics.findUnread = function (userId: Types.ObjectId) {
  return this.find({
    recipient: userId,
    isRead: false,
  })
    .sort({ createdAt: -1 })
    .limit(50);
};

/**
 * Static method: Find notifications by type for user
 */
notificationSchema.statics.findByType = function (
  userId: Types.ObjectId,
  type: string,
  limit: number = 20
) {
  return this.find({
    recipient: userId,
    type,
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

/**
 * Static method: Find notifications by entity
 */
notificationSchema.statics.findByEntity = function (
  entityId: Types.ObjectId,
  entityType?: string
) {
  const query: any = {
    "relatedEntity.entityId": entityId,
  };

  if (entityType) {
    query["relatedEntity.entityType"] = entityType;
  }

  return this.find(query).sort({ createdAt: -1 });
};

/**
 * Static method: Mark all as read for user
 */
notificationSchema.statics.markAllAsRead = async function (
  userId: Types.ObjectId
): Promise<number> {
  const result = await this.updateMany(
    {
      recipient: userId,
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    }
  );
  return result.modifiedCount;
};

/**
 * Static method: Delete notification
 */
notificationSchema.statics.deleteNotification = async function (
  notificationId: Types.ObjectId,
  userId: Types.ObjectId
): Promise<boolean> {
  const result = await this.deleteOne({
    _id: notificationId,
    recipient: userId,
  });
  return result.deletedCount > 0;
};

/**
 * Static method: Get notification summary for user
 */
notificationSchema.statics.getSummary = async function (
  userId: Types.ObjectId
) {
  return this.aggregate([
    { $match: { recipient: userId } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
        byType: {
          $push: {
            type: "$type",
            count: 1,
          },
        },
      },
    },
  ]);
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
 * Instance method: Mark as unread
 */
notificationSchema.methods.markAsUnread = async function (): Promise<void> {
  this.isRead = false;
  this.readAt = undefined;
  await this.save();
};

/**
 * Instance method: Get delivery status summary
 */
notificationSchema.methods.getDeliveryStatus = function (): string {
  const statuses: string[] = [];

  if (this.deliveryStatus.in_app?.sent) {
    statuses.push("In-app: Delivered");
  }

  if (this.deliveryStatus.email?.sent) {
    statuses.push(
      this.deliveryStatus.email.bounced ? "Email: Bounced" : "Email: Delivered"
    );
  }

  if (this.deliveryStatus.sms?.sent) {
    statuses.push("SMS: Delivered");
  }

  return statuses.length > 0 ? statuses.join(", ") : "Pending delivery";
};

/**
 * Notification Model
 */
export const Notification = model<INotification>(
  "Notification",
  notificationSchema
);