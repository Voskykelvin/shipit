import { Router, Request, Response } from 'express';
import { prisma } from '@shipit/database';
import { domainEventEmitter } from './jobs.js';

export type NotificationChannel = 'SMS' | 'WHATSAPP';

export interface SentNotificationRecord {
  id: string;
  orderId?: string;
  orderNumber?: string;
  recipientPhone: string;
  channel: NotificationChannel;
  template: string;
  body: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
  provider: string;
  sentAt: string;
}

// In-memory circular log for recent dispatched notifications (last 200)
const notificationLog: SentNotificationRecord[] = [];

function logNotification(record: SentNotificationRecord) {
  notificationLog.unshift(record);
  if (notificationLog.length > 200) {
    notificationLog.pop();
  }
}

export function formatKenyaPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('254')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+254${cleaned.slice(1)}`;
  return cleaned;
}

export interface SendMessageOptions {
  recipientPhone: string;
  channel: NotificationChannel;
  message: string;
  orderId?: string;
  orderNumber?: string;
  template?: string;
}

export async function dispatchNotification(options: SendMessageOptions): Promise<SentNotificationRecord> {
  const phone = formatKenyaPhone(options.recipientPhone);
  const id = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let provider = 'SIMULATOR';
  let status: 'SENT' | 'DELIVERED' | 'FAILED' = 'SENT';

  if (options.channel === 'SMS') {
    const atApiKey = process.env.AFRICASTALKING_API_KEY;
    const atUsername = process.env.AFRICASTALKING_USERNAME;
    const atSender = process.env.AFRICASTALKING_SENDER_ID;

    if (atApiKey && atUsername) {
      provider = "AFRICA'S TALKING";
      try {
        const response = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            apiKey: atApiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            username: atUsername,
            to: phone,
            message: options.message,
            ...(atSender ? { from: atSender } : {}),
          }).toString(),
        });
        if (response.ok) {
          status = 'DELIVERED';
        } else {
          status = 'FAILED';
        }
      } catch (err) {
        console.error('AfricaTalking SMS delivery failed', err);
        status = 'FAILED';
      }
    } else {
      // Local dev / test simulator
      provider = 'SIMULATOR_SMS';
      status = 'DELIVERED';
      console.info(`[SMS SIMULATOR] To: ${phone} | Body: "${options.message}"`);
    }
  } else {
    // WhatsApp Channel
    const waToken = process.env.WHATSAPP_API_TOKEN;
    const waPhoneId = process.env.WHATSAPP_PHONE_ID;

    if (waToken && waPhoneId) {
      provider = 'META_WHATSAPP_CLOUD';
      try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${waToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone.replace('+', ''),
            type: 'text',
            text: { preview_url: true, body: options.message },
          }),
        });
        if (response.ok) {
          status = 'DELIVERED';
        } else {
          status = 'FAILED';
        }
      } catch (err) {
        console.error('WhatsApp API delivery failed', err);
        status = 'FAILED';
      }
    } else {
      provider = 'SIMULATOR_WHATSAPP';
      status = 'DELIVERED';
      console.info(`[WHATSAPP SIMULATOR] To: ${phone} | Body: "${options.message}"`);
    }
  }

  const record: SentNotificationRecord = {
    id,
    orderId: options.orderId,
    orderNumber: options.orderNumber,
    recipientPhone: phone,
    channel: options.channel,
    template: options.template ?? 'MANUAL_DISPATCH',
    body: options.message,
    status,
    provider,
    sentAt: new Date().toISOString(),
  };

  logNotification(record);
  return record;
}

// Background event listener for automated customer touchpoints
domainEventEmitter.on('event', (event: { type: string; payload: Record<string, unknown>; entityId: string }) => {
  void (async () => {
    try {
      if (event.type === 'ndr.created') {
        const orderId = String(event.payload.orderId ?? event.entityId);
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true, customerPhone: true, customerName: true, waybillNumber: true },
        });
        if (order) {
          const reason = String(event.payload.failureReason ?? 'unreachable').replaceAll('_', ' ').toLowerCase();
          const trackingUrl = `https://shipit.co.ke/track?waybill=${encodeURIComponent(order.waybillNumber ?? order.orderNumber)}`;
          const message = `Hi ${order.customerName}, our Ship It rider was unable to complete your delivery (${reason}) for order #${order.orderNumber}. Please update your instructions or reschedule: ${trackingUrl}`;
          
          await dispatchNotification({
            recipientPhone: order.customerPhone,
            channel: 'SMS',
            orderId: order.id,
            orderNumber: order.orderNumber,
            template: 'NDR_INTERCEPTION',
            message,
          });
        }
      } else if (event.type === 'delivery.completed') {
        const orderId = String(event.payload.orderId ?? event.entityId);
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderNumber: true, customerPhone: true, customerName: true, codAmountExpectedKes: true },
        });
        if (order) {
          const message = `Hello ${order.customerName}, your Ship It parcel #${order.orderNumber} has been successfully delivered. Thank you for shopping!`;
          await dispatchNotification({
            recipientPhone: order.customerPhone,
            channel: 'SMS',
            orderId: order.id,
            orderNumber: order.orderNumber,
            template: 'DELIVERY_CONFIRMED',
            message,
          });
        }
      }
    } catch (err) {
      console.error('Failed to process automated notification trigger', err);
    }
  })();
});

export const notificationsRouter = Router();

// GET /notifications/log
notificationsRouter.get('/notifications/log', (req: Request, res: Response) => {
  return res.json({
    total: notificationLog.length,
    notifications: notificationLog,
  });
});

// POST /notifications/send
notificationsRouter.post('/notifications/send', async (req: Request, res: Response) => {
  const { recipientPhone, channel, message, orderId, orderNumber, template } = req.body ?? {};

  if (!recipientPhone || !channel || !message) {
    return res.status(400).json({ error: 'recipientPhone, channel, and message are required.' });
  }

  if (!['SMS', 'WHATSAPP'].includes(String(channel))) {
    return res.status(400).json({ error: "Channel must be 'SMS' or 'WHATSAPP'." });
  }

  try {
    const record = await dispatchNotification({
      recipientPhone: String(recipientPhone),
      channel: channel as NotificationChannel,
      message: String(message),
      orderId: orderId ? String(orderId) : undefined,
      orderNumber: orderNumber ? String(orderNumber) : undefined,
      template: template ? String(template) : 'CUSTOM_STAFF_DISPATCH',
    });

    return res.status(201).json({
      success: true,
      notification: record,
    });
  } catch (err) {
    console.error('Failed to dispatch notification', err);
    return res.status(500).json({ error: 'Failed to dispatch notification.' });
  }
});
