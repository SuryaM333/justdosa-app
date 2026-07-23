import { Booking } from '../types';
import { formatAusMobile } from '../utils/phone';

export interface SMSLog {
  id: string;
  phone: string;
  recipientName: string;
  message: string;
  type: 'confirmation' | 'reminder' | 'table_ready' | 'cancellation';
  status: 'sent' | 'queued' | 'failed';
  timestamp: string;
}

class SMSService {
  private logs: SMSLog[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    // Load persisted logs from localStorage if available
    try {
      const saved = localStorage.getItem('just_dosa_sms_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (err) {
      console.warn('Failed to load SMS logs:', err);
    }
  }

  private saveLogs() {
    try {
      localStorage.setItem('just_dosa_sms_logs', JSON.stringify(this.logs.slice(0, 100)));
    } catch (e) {
      // ignore
    }
    this.notifyListeners();
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  public getLogs(): SMSLog[] {
    return [...this.logs];
  }

  public async sendConfirmationSMS(booking: Booking): Promise<boolean> {
    if (!booking.phone) return false;

    const formattedPhone = formatAusMobile(booking.phone);
    const dateStr = booking.bookingDate || 'today';
    const timeStr = booking.bookingTime || 'scheduled time';
    const partyStr = `${booking.partySize} guest${booking.partySize > 1 ? 's' : ''}`;

    const message = `Just Dosa: Hi ${booking.firstName}, your table reservation for ${dateStr} at ${timeStr} (${partyStr}) is CONFIRMED! We look forward to hosting you.`;

    const log: SMSLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      phone: formattedPhone,
      recipientName: `${booking.firstName} ${booking.lastName || ''}`.trim(),
      message,
      type: 'confirmation',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    console.log(`📱 [SMS SENT] To ${formattedPhone}: "${message}"`);
    this.logs.unshift(log);
    this.saveLogs();
    return true;
  }

  public async sendTwoHourReminderSMS(booking: Booking): Promise<boolean> {
    if (!booking.phone) return false;

    const formattedPhone = formatAusMobile(booking.phone);
    const timeStr = booking.bookingTime || 'upcoming slot';

    const message = `Just Dosa Reminder: Hi ${booking.firstName}, your table reservation is coming up today at ${timeStr} (${booking.partySize} guests). Please arrive 5 mins early!`;

    const log: SMSLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      phone: formattedPhone,
      recipientName: `${booking.firstName} ${booking.lastName || ''}`.trim(),
      message,
      type: 'reminder',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    console.log(`📱 [SMS REMINDER SENT] To ${formattedPhone}: "${message}"`);
    this.logs.unshift(log);
    this.saveLogs();
    return true;
  }

  public async sendTableReadySMS(booking: Booking, tableId?: number): Promise<boolean> {
    if (!booking.phone) return false;

    const formattedPhone = formatAusMobile(booking.phone);
    const message = `Just Dosa: Hi ${booking.firstName}, your table ${tableId ? `#${tableId}` : ''} is READY! Please make your way to the host desk.`;

    const log: SMSLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      phone: formattedPhone,
      recipientName: `${booking.firstName} ${booking.lastName || ''}`.trim(),
      message,
      type: 'table_ready',
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    console.log(`📱 [SMS TABLE READY SENT] To ${formattedPhone}: "${message}"`);
    this.logs.unshift(log);
    this.saveLogs();
    return true;
  }
}

export const smsService = new SMSService();
