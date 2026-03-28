import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService, SlotTime } from './booking.service';

@Component({
  selector: 'app-booking-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="booking-container">
      <h2>Book Your Studio Slot</h2>
      <p class="subtitle"><i>Get in touch with us directly if you would like to book a special event, on our facebook page</i></p>
      <p class="subtitle">Select a date from the calendar to view available times.</p>
      
      <div class="legend">
        <div class="legend-item"><span class="dot green"></span> Good Availability</div>
        <div class="legend-item"><span class="dot yellow"></span> Limited Availability</div>
        <div class="legend-item"><span class="dot red"></span> Unavailable / Pending</div>
      </div>

      <div class="booking-layout">
        <!-- Calendar Section -->
        <section class="calendar-section">
          <div class="calendar-controls">
            <button (click)="changeMonth(-1)" [disabled]="isCurrentMonth()">&lsaquo; Prev</button>
            <h3>{{ viewDate() | date:'MMMM yyyy' }}</h3>
            <button (click)="changeMonth(1)">Next &rsaquo;</button>
          </div>

          <div class="calendar-grid">
            <div class="weekday" *ngFor="let day of weekDays">{{ day }}</div>
            <div *ngFor="let empty of calendarPadding()" class="calendar-day empty"></div>
            
            <div *ngFor="let day of calendarDays()" 
                 class="calendar-day" 
                 [class.selected]="selectedDate() === day"
                 [class.past]="isPast(day)"
                 [class.status-green]="getAvailabilityStatus(day) === 'green'"
                 [class.status-yellow]="getAvailabilityStatus(day) === 'yellow'"
                 [class.status-red]="getAvailabilityStatus(day) === 'red'"
                 (click)="selectDay(day)">
              <span class="day-number">{{ day | date:'d' }}</span>
            </div>
          </div>
        </section>

        <!-- Time & Booking Section -->
        <section class="booking-details">
          @if (selectedDate()) {
            <div class="time-selection">
              <h3>Times for {{ selectedDate() | date:'longDate' }}</h3>
              
              <div class="slots-list">
                @for (slot of selectedDaySlots(); track slot.time) {
                  <button 
                    class="slot-btn" 
                    [class.selected]="selectedSlot() === slot.time"
                    [disabled]="slot.status !== 'open'"
                    (click)="selectedSlot.set(slot.time)"
                  >
                    <span class="slot-time">{{ slot.time }}</span>
                    <span class="slot-status">
                      @if (slot.status === 'open') { Available }
                      @else if (slot.status === 'pending') { Requested }
                      @else { Unavailable }
                    </span>
                  </button>
                } @empty {
                  <p class="no-slots">This date is currently blocked or not yet open for bookings.</p>
                }
              </div>

              @if (selectedSlot()) {
                <div class="booking-form">
                  <h4>Request This Slot</h4>
                  
                  <div class="form-group">
                    <label>Full Name</label>
                    <input [(ngModel)]="customerName" placeholder="e.g. John Doe" />
                  </div>
                  <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" [(ngModel)]="customerEmail" placeholder="e.g. john@example.com" />
                  </div>
                  <div class="form-group">
                    <label>Phone Number (Optional)</label>
                    <input type="tel" [(ngModel)]="customerPhone" placeholder="e.g. 07123 456789" />
                  </div>
                  <div class="form-group">
                    <label>Number of People (1-6)</label>
                    <input 
                      type="number" 
                      [(ngModel)]="numberOfPeople" 
                      min="1" 
                      max="6" 
                      readonly
                      style="cursor: default;"
                    />
                    <div class="stepper-controls">
                      <button (click)="adjustPeople(-1)" [disabled]="numberOfPeople() <= 1">-</button>
                      <button (click)="adjustPeople(1)" [disabled]="numberOfPeople() >= 6">+</button>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Comments / Special Requests</label>
                    <textarea [(ngModel)]="comments" placeholder="Any details we should know?" rows="3"></textarea>
                  </div>
                  
                  <button 
                    class="confirm-btn" 
                    (click)="confirmRequest()" 
                    [disabled]="!customerName() || !isValidEmail() || numberOfPeople() < 1 || numberOfPeople() > 6"
                  >
                    Send Booking Request
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="select-hint">
              <p>Please select an available date on the calendar to begin.</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    .booking-container { max-width: 1000px; margin: 0 auto; padding: 20px; font-family: sans-serif; color: #4a4a4a; }
    h2 { text-align: center; margin-bottom: 0.5rem; color: #d63384; font-weight: 800; }
    .subtitle { text-align: center; margin-bottom: 2rem; color: #8a6d71; }
    
    .legend { display: flex; justify-content: center; gap: 20px; margin-bottom: 20px; font-size: 0.85rem; }
    .legend-item { display: flex; align-items: center; gap: 6px; color: #8a6d71; font-weight: 600; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.green { background: #28a745; }
    .dot.yellow { background: #ffc107; }
    .dot.red { background: #dc3545; }

    .booking-layout { display: grid; grid-template-columns: 1fr 400px; gap: 40px; }
    
    @media (max-width: 900px) {
      .booking-layout { grid-template-columns: 1fr; gap: 20px; }
      .legend { flex-wrap: wrap; }
    }

    /* Calendar */
    .calendar-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .calendar-controls h3 { color: #d63384; margin: 0; }
    .calendar-controls button { padding: 5px 15px; cursor: pointer; border: 1px solid #ffe4e8; background: white; border-radius: 4px; color: #d63384; font-weight: bold; }
    .calendar-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
    
    .calendar-grid { background: #fff; display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #ffe4e8; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(214, 51, 132, 0.05); }
    .weekday { background: #fff0f3; padding: 12px; text-align: center; font-weight: bold; font-size: 0.8rem; border-bottom: 1px solid #ffe4e8; color: #d63384; }
    .calendar-day { min-height: 70px; padding: 10px; border-right: 1px solid #fff0f3; border-bottom: 1px solid #fff0f3; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; position: relative; }
    
    @media (max-width: 500px) {
      .calendar-day { min-height: 50px; padding: 5px; font-size: 0.9rem; }
      .weekday { padding: 8px; font-size: 0.7rem; }
    }

    .calendar-day:hover:not(.empty):not(.past) { background: #fff0f3; transform: scale(1.02); z-index: 1; }
    .calendar-day.selected { border: 2px solid #d63384 !important; background: #fff0f3 !important; font-weight: bold; }
    .calendar-day.empty { background: #fafafa; cursor: default; }
    .calendar-day.past { opacity: 0.3; cursor: not-allowed; background: #f9f9f9; }

    /* Availability Colors */
    .status-green { background-color: #e6ffed; color: #155724; border-bottom: 4px solid #28a745; }
    .status-yellow { background-color: #fff9db; color: #856404; border-bottom: 4px solid #ffc107; }
    .status-red { background-color: #fce8e8; color: #721c24; border-bottom: 4px solid #dc3545; }

    /* Booking Panel */
    .booking-details { background: #fff; border: 1px solid #ffe4e8; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(214, 51, 132, 0.05); min-height: 400px; }
    .slots-list { display: flex; flex-direction: column; gap: 10px; margin: 20px 0; }
    .slot-btn { display: flex; justify-content: space-between; align-items: center; padding: 15px; border: 1px solid #ffe4e8; border-radius: 8px; background: white; cursor: pointer; transition: all 0.2s; color: #d63384; font-weight: 600; }
    .slot-btn:hover:not(:disabled) { border-color: #d63384; background: #fff0f3; }
    .slot-btn.selected { border-color: #d63384; background: #d63384; color: white; }
    .slot-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #f8f9fa; color: #ccc; }
    .slot-status { font-size: 0.75rem; text-transform: uppercase; }

    .booking-form { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ffe4e8; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px; color: #d63384; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ffe4e8; border-radius: 6px; box-sizing: border-box; color: #4a4a4a; }
    .form-group input:focus, .form-group textarea:focus { outline: none; border-color: #d63384; box-shadow: 0 0 0 2px rgba(214, 51, 132, 0.1); }
    
    .stepper-controls { display: flex; gap: 5px; margin-top: 5px; }
    .stepper-controls button { flex: 1; padding: 10px; border: 1px solid #ffe4e8; background: #fff0f3; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 1.2rem; color: #d63384; }
    .stepper-controls button:hover:not(:disabled) { background: #ffe4e8; }
    .stepper-controls button:disabled { opacity: 0.5; cursor: not-allowed; }

    .confirm-btn { width: 100%; padding: 15px; background: #d63384; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; transition: background 0.3s; }
    .confirm-btn:hover:not(:disabled) { background: #b82a6f; }
    .confirm-btn:disabled { background: #ccc; cursor: not-allowed; }
    .no-slots { color: #8a6d71; font-style: italic; text-align: center; padding: 40px; }
    .select-hint { text-align: center; color: #8a6d71; padding-top: 100px; }
  `]
})
export class BookingView {
  bookingService = inject(BookingService);
  
  viewDate = signal(new Date());
  selectedDate = signal<string | null>(null);
  selectedSlot = signal<SlotTime | null>(null);
  customerName = signal('');
  customerEmail = signal('');
  customerPhone = signal('');
  numberOfPeople = signal(1);
  comments = signal('');

  isValidEmail = computed(() => {
    const email = this.customerEmail().trim();
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  });

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  adjustPeople(delta: number) {
    const current = this.numberOfPeople();
    const next = current + delta;
    if (next >= 1 && next <= 6) {
      this.numberOfPeople.set(next);
    }
  }

  calendarPadding = computed(() => {
    const date = this.viewDate();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return Array(firstDay).fill(0);
  });

  calendarDays = computed(() => {
    const date = this.viewDate();
    const year = date.getFullYear();
    const month = date.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 1; i <= lastDay; i++) {
      const y = year;
      const m = String(month + 1).padStart(2, '0');
      const d = String(i).padStart(2, '0');
      days.push(`${y}-${m}-${d}`);
    }
    return days;
  });

  selectedDaySlots = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    return this.bookingService.daySchedules().find(d => d.date === date)?.slots || [];
  });

  getAvailabilityStatus(dateStr: string): 'green' | 'yellow' | 'red' | null {
    if (this.isPast(dateStr)) return 'red';
    const day = this.bookingService.daySchedules().find(d => d.date === dateStr);
    if (!day) return 'red';
    const openCount = day.slots.filter(s => s.status === 'open').length;
    if (openCount === 3) return 'green';
    if (openCount >= 1) return 'yellow';
    return 'red';
  }

  isPast(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dateStr.split('-');
    const targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    targetDate.setHours(0, 0, 0, 0);
    return targetDate <= today;
  }

  isCurrentMonth(): boolean {
    const today = new Date();
    const view = this.viewDate();
    return view.getMonth() === today.getMonth() && view.getFullYear() === today.getFullYear();
  }

  changeMonth(delta: number) {
    const current = this.viewDate();
    const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
    const today = new Date();
    const minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next >= minDate) {
      this.viewDate.set(next);
      this.selectedDate.set(null);
      this.selectedSlot.set(null);
    }
  }

  selectDay(dateStr: string) {
    if (this.isPast(dateStr)) return;
    this.selectedDate.set(dateStr);
    this.selectedSlot.set(null);
  }

  async confirmRequest() {
    const date = this.selectedDate();
    const slot = this.selectedSlot();
    if (date && slot) {
      try {
        await this.bookingService.requestBooking({
          date,
          slot,
          customerName: this.customerName(),
          customerEmail: this.customerEmail(),
          customerPhone: this.customerPhone(),
          numberOfPeople: this.numberOfPeople(),
          comments: this.comments()
        });
        alert('Request Sent! We will email you once the owner approves your booking.');
        this.selectedDate.set(null);
        this.selectedSlot.set(null);
        this.customerName.set('');
        this.customerEmail.set('');
        this.customerPhone.set('');
        this.numberOfPeople.set(1);
        this.comments.set('');
      } catch (e: any) {
        alert(e.message);
      }
    }
  }
}
