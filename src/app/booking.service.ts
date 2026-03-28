import { Injectable, signal, inject } from '@angular/core';
import { Firestore, collection, onSnapshot, doc, setDoc, deleteDoc } from '@angular/fire/firestore';
import emailjs from '@emailjs/browser';

export type SlotTime = string;
export type SlotStatus = 'open' | 'closed' | 'blocked' | 'booked' | 'pending';

export interface TimeSlot {
  time: SlotTime;
  status: SlotStatus;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export interface Booking {
  id: string;
  date: string;
  slot: SlotTime;
  customerName: string;
  customerEmail: string;
  numberOfPeople: number;
  comments: string;
  status: 'pending' | 'confirmed';
}

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private firestore = inject(Firestore);
  
  // --- EMAILJS CONFIGURATION ---
  private readonly EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
  private readonly EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
  private readonly ADMIN_TEMPLATE_ID = 'YOUR_ADMIN_TEMPLATE_ID';
  private readonly CUSTOMER_TEMPLATE_ID = 'YOUR_CUSTOMER_TEMPLATE_ID';

  readonly daySchedules = signal<DaySchedule[]>([]);
  readonly allBookings = signal<Booking[]>([]);

  constructor() {
    this.initRealtimeSync();
  }

  private initRealtimeSync() {
    onSnapshot(collection(this.firestore, 'schedules'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), date: d.id } as DaySchedule));
      this.daySchedules.set(data);
    });

    onSnapshot(collection(this.firestore, 'bookings'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Booking));
      this.allBookings.set(data);
    });
  }

  async toggleDay(date: string) {
    const day = this.daySchedules().find(d => d.date === date);
    const activeBookings = this.allBookings().filter(b => b.date === date);

    if (day) {
      if (activeBookings.length > 0) throw new Error('CANCEL_USER');
      await deleteDoc(doc(this.firestore, `schedules/${date}`));
    } else {
      const defaultSlots: TimeSlot[] = [
        { time: '10:00 AM', status: 'open' },
        { time: '01:00 PM', status: 'open' },
        { time: '04:00 PM', status: 'open' }
      ];
      await setDoc(doc(this.firestore, `schedules/${date}`), { slots: defaultSlots });
    }
  }

  async updateSlotStatus(date: string, time: SlotTime, status: SlotStatus) {
    const day = this.daySchedules().find(d => d.date === date);
    if (!day) return;
    const updatedSlots = day.slots.map(s => s.time === time ? { ...s, status } : s);
    await setDoc(doc(this.firestore, `schedules/${date}`), { slots: updatedSlots }, { merge: true });
  }

  async addSlot(date: string, time: string) {
    const day = this.daySchedules().find(d => d.date === date);
    if (!day) return;
    
    if (day.slots.some(s => s.time === time)) {
      throw new Error('This time slot already exists.');
    }

    const updatedSlots = [...day.slots, { time, status: 'open' as SlotStatus }];
    await setDoc(doc(this.firestore, `schedules/${date}`), { slots: updatedSlots }, { merge: true });
  }

  async addManualBooking(bookingData: Omit<Booking, 'id' | 'status'>) {
    const id = Math.random().toString(36).substring(7);
    const bookingDoc = doc(this.firestore, `bookings/${id}`);
    
    await setDoc(bookingDoc, { ...bookingData, id, status: 'confirmed' });
    await this.updateSlotStatus(bookingData.date, bookingData.slot, 'booked');
    return id;
  }

  async requestBooking(bookingData: Omit<Booking, 'id' | 'status'>) {
    const id = Math.random().toString(36).substring(7);
    const bookingDoc = doc(this.firestore, `bookings/${id}`);
    
    await setDoc(bookingDoc, { ...bookingData, id, status: 'pending' });
    await this.updateSlotStatus(bookingData.date, bookingData.slot, 'pending');
    
    try {
      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.ADMIN_TEMPLATE_ID,
        {
          customer_name: bookingData.customerName,
          customer_email: bookingData.customerEmail,
          booking_date: bookingData.date,
          booking_slot: bookingData.slot,
          people_count: bookingData.numberOfPeople,
          comments: bookingData.comments || 'None'
        },
        this.EMAILJS_PUBLIC_KEY
      );
    } catch (error) {
      console.error('EmailJS Admin Alert Error:', error);
    }
    
    return id;
  }

  getConfirmationEmailTemplate(booking: Booking) {
    return `Hi ${booking.customerName},\n\n` +
           `Great news! Your pottery painting session for ${booking.date} at ${booking.slot} has been confirmed for ${booking.numberOfPeople} people.\n\n` +
           `LOCATION: 17 St Mary's Close, South Wootton PE30 3LL\n\n` +
           `ABOUT THE SESSION: This will be a 2-hour guided painting experience where you'll be painting pre-fired bisque pieces. We provide all the bisques, glazes, and brushes you need. Please arrive 10 minutes early. We look forward to seeing you!`;
  }

  async confirmBooking(bookingId: string, customBody?: string) {
    const booking = this.allBookings().find(b => b.id === bookingId);
    if (!booking) return;

    await setDoc(doc(this.firestore, `bookings/${bookingId}`), { status: 'confirmed' }, { merge: true });
    await this.updateSlotStatus(booking.date, booking.slot, 'booked');

    // Use customBody if provided, otherwise fallback to template
    const finalBody = customBody || this.getConfirmationEmailTemplate(booking);

    try {
      await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.CUSTOMER_TEMPLATE_ID,
        {
          to_name: booking.customerName,
          to_email: booking.customerEmail,
          booking_date: booking.date,
          booking_slot: booking.slot,
          people_count: booking.numberOfPeople,
          message_body: finalBody
        },
        this.EMAILJS_PUBLIC_KEY
      );
    } catch (error) {
      console.error('EmailJS Customer Confirmation Error:', error);
    }
  }

  async declineBooking(bookingId: string) {
    const booking = this.allBookings().find(b => b.id === bookingId);
    if (!booking) return;

    await deleteDoc(doc(this.firestore, `bookings/${bookingId}`));
    await this.updateSlotStatus(booking.date, booking.slot, 'open');
  }

  async cancelBooking(bookingId: string) {
    const booking = this.allBookings().find(b => b.id === bookingId);
    if (booking) {
      await deleteDoc(doc(this.firestore, `bookings/${bookingId}`));
      await this.updateSlotStatus(booking.date, booking.slot, 'open');
    }
  }
}
