import { TestBed } from '@angular/core/testing';
import { BookingService } from './booking.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('BookingService', () => {
  let service: BookingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BookingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with some open dates', () => {
    const statuses = service.dayStatuses();
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0].status).toBe('open');
  });

  it('should allow updating day status', () => {
    const firstDate = service.dayStatuses()[0].date;
    service.updateDayStatus(firstDate, 'blocked');
    expect(service.getDayStatus(firstDate)).toBe('blocked');
  });

  it('should book an open date', () => {
    const firstDate = service.dayStatuses()[0].date;
    const booking = service.bookDate({
      date: firstDate,
      customerName: 'Test User',
      customerEmail: 'test@example.com'
    });

    expect(booking.id).toBeDefined();
    expect(service.getDayStatus(firstDate)).toBe('booked');
    expect(service.bookings().length).toBe(1);
  });

  it('should not book a closed date', () => {
    const firstDate = service.dayStatuses()[0].date;
    service.updateDayStatus(firstDate, 'closed');
    
    expect(() => {
      service.bookDate({
        date: firstDate,
        customerName: 'Test User',
        customerEmail: 'test@example.com'
      });
    }).toThrow('Date is no longer available');
  });

  it('should allow canceling a booking', () => {
    const firstDate = service.dayStatuses()[0].date;
    const booking = service.bookDate({
      date: firstDate,
      customerName: 'Test User',
      customerEmail: 'test@example.com'
    });

    service.cancelBooking(booking.id);
    expect(service.bookings().length).toBe(0);
    expect(service.getDayStatus(firstDate)).toBe('open');
  });
});
