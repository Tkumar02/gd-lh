import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingService, SlotTime, SlotStatus, Booking } from './booking.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-admin-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page-wrapper">
      <div class="admin-container">
        <div class="header">
        <h1>Owner Dashboard</h1>
        <div class="user-info">
          <span>{{ auth.user()?.email }}</span>
          <button class="logout-btn" (click)="auth.logout()">Logout</button>
        </div>
      </div>

      <div class="summary-bar">
        <div class="summary-item pending">
          <span class="count">{{ pendingBookings().length }}</span>
          <span class="label">Pending</span>
        </div>
        <div class="summary-item confirmed">
          <span class="count">{{ confirmedBookings().length }}</span>
          <span class="label">Confirmed</span>
        </div>
        <div class="summary-item open">
          <span class="count">{{ totalOpenSlots() }}</span>
          <span class="label">Open Slots</span>
        </div>
      </div>
      
      <div class="dashboard-layout">
        <!-- Calendar Management -->
        <section class="calendar-section">
          <div class="calendar-controls">
            <button (click)="changeMonth(-1)">&lsaquo; Prev</button>
            <h2>{{ viewDate() | date:'MMMM yyyy' }}</h2>
            <button (click)="changeMonth(1)">Next &rsaquo;</button>
          </div>

          <div class="calendar-grid">
            <div class="weekday" *ngFor="let day of weekDays">{{ day }}</div>
            <div *ngFor="let empty of calendarPadding()" class="calendar-day empty"></div>
            
            <div *ngFor="let day of calendarDays()" 
                 class="calendar-day" 
                 [class.has-slots]="getDaySchedule(day)"
                 [class.selected]="selectedDate() === day"
                 (click)="selectDay(day)">
              <span class="day-number">{{ day | date:'d' }}</span>
              @if (getDaySchedule(day)) {
                <div class="day-indicators">
                  <div class="dot" *ngFor="let s of getDaySchedule(day)?.slots" [class]="s.status"></div>
                </div>
              }
            </div>
          </div>
          <p class="hint">Click a date to select it. Use the panel on the right to open/block or manage slots.</p>
        </section>

        <!-- Right Side: Detail Panel -->
        <section class="detail-panel">
          @if (selectedDate()) {
            <div class="selected-day-info">
              <h3>Manage: {{ selectedDate() | date:'fullDate' }}</h3>
              
              @if (!getDaySchedule(selectedDate()!)) {
                <div class="empty-state">
                  <p>This day is currently <strong>Blocked</strong>.</p>
                  <button class="open-day-btn" (click)="toggleDayStatus(selectedDate()!)">Open this Day</button>
                </div>
              } @else {
                <div class="slot-management">
                  <div *ngFor="let slot of getDaySchedule(selectedDate()!)?.slots" class="slot-row" [class]="slot.status">
                    <div class="slot-info">
                      <div class="slot-time-row">
                        <strong>{{ slot.time }}</strong>
                        <span class="status-text">{{ slot.status }}</span>
                      </div>
                      
                      @if (getBookingForSlot(selectedDate()!, slot.time); as booking) {
                        <div class="slot-booking-details">
                          <div class="customer-name"><strong>{{ booking.customerName }}</strong> ({{ booking.numberOfPeople }} people)</div>
                          <div class="customer-info">{{ booking.customerEmail }} {{ booking.customerPhone ? '| ' + booking.customerPhone : '' }}</div>
                          @if (booking.comments) {
                            <div class="customer-notes">Note: {{ booking.comments }}</div>
                          }
                        </div>
                      }
                    </div>
                    <div class="slot-actions">
                      @if (slot.status === 'booked' || slot.status === 'pending') {
                         <div class="status-group">
                           <span class="status-badge" [class]="slot.status">{{ slot.status }}</span>
                           @if (slot.status === 'pending') {
                             <button class="mini-confirm-btn" (click)="openPreview(getBookingForSlot(selectedDate()!, slot.time)!)">Process</button>
                           }
                         </div>
                      } @else {
                        <div class="action-btns">
                          <button class="direct-book-btn" (click)="openDirectBooking(slot.time)">Direct Book</button>
                          <button class="slot-toggle-btn" (click)="toggleSlot(slot)">
                            {{ slot.status === 'open' ? 'Block' : 'Open' }}
                          </button>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="add-slot-form">
                    <select [(ngModel)]="newSlotHour" class="time-select">
                      <option *ngFor="let h of ['01','02','03','04','05','06','07','08','09','10','11','12']" [value]="h">{{h}}</option>
                    </select>
                    <span class="colon">:</span>
                    <select [(ngModel)]="newSlotMin" class="time-select">
                      <option *ngFor="let m of ['00','15','30','45']" [value]="m">{{m}}</option>
                    </select>
                    <button class="toggle-period-btn" (click)="togglePeriod()">{{ newSlotPeriod() }}</button>
                    <button class="add-btn" (click)="addNewSlot()">Add Slot</button>
                  </div>

                  <button class="danger-btn" (click)="toggleDayStatus(selectedDate()!)">Block Entire Day</button>
                </div>
              }
            </div>
          } @else {
            <div class="select-hint">
              <p>Select a date from the calendar to manage its availability.</p>
            </div>
          }
        </section>
      </div>

      <!-- DIRECT BOOKING MODAL -->
      @if (directBookingSlot()) {
        <div class="modal-overlay">
          <div class="modal-content">
            <h3>Direct Booking: {{ directBookingSlot() }}</h3>
            <p class="modal-intro">Add a customer manually (e.g. from phone/FB):</p>
            
            <div class="form-group">
              <label>Name</label>
              <input [(ngModel)]="manualName" placeholder="Customer Name" />
            </div>
            <div class="form-group">
              <label>Email (Optional)</label>
              <input [(ngModel)]="manualEmail" placeholder="customer@example.com" />
            </div>
            <div class="form-group">
              <label>Phone (Optional)</label>
              <input [(ngModel)]="manualPhone" placeholder="07123 456789" />
            </div>
            <div class="form-group">
              <label>People</label>
              <input type="number" [(ngModel)]="manualPeople" min="1" max="6" />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea [(ngModel)]="manualComments" placeholder="Source: Phone call, etc."></textarea>
            </div>

            <div class="modal-footer">
              <button class="cancel-modal-btn" (click)="closeDirectBooking()">Cancel</button>
              <button class="send-confirm-btn" (click)="confirmDirectBooking()" [disabled]="!manualName() || processing()">
                {{ processing() ? 'Saving...' : 'Confirm Booking' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Pending Bookings Table -->
      <section class="bookings-section pending-section">
        <h3>Requests Awaiting Approval</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>People</th>
                <th>Comments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (booking of pendingBookings(); track booking.id) {
                <tr>
                  <td>{{ booking.date | date:'dd/MM/yyyy' }}</td>
                  <td>{{ booking.slot }}</td>
                  <td>
                    <div><strong>{{ booking.customerName }}</strong></div>
                    <div class="email-sub">{{ booking.customerEmail }} {{ booking.customerPhone ? '| ' + booking.customerPhone : '' }}</div>
                  </td>
                  <td>{{ booking.numberOfPeople }}</td>
                  <td class="comment-cell">{{ booking.comments || '-' }}</td>
                  <td>
                    <button class="confirm-action-btn" (click)="openPreview(booking)">Confirm</button>
                    <button class="decline-action-btn" (click)="bookingService.declineBooking(booking.id)">Decline</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-msg">No pending requests.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Confirmed Bookings Table -->
      <section class="bookings-section">
        <h3>Confirmed Bookings</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>People</th>
                <th>Comments</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (booking of confirmedBookings(); track booking.id) {
                <tr>
                  <td>{{ booking.date | date:'dd/MM/yyyy' }}</td>
                  <td>{{ booking.slot }}</td>
                  <td>
                    <div><strong>{{ booking.customerName }}</strong></div>
                    <div class="email-sub">{{ booking.customerEmail }} {{ booking.customerPhone ? '| ' + booking.customerPhone : '' }}</div>
                  </td>
                  <td>{{ booking.numberOfPeople }}</td>
                  <td class="comment-cell">{{ booking.comments || '-' }}</td>
                  <td>
                    <button class="cancel-btn" (click)="cancelBookingWithAlert(booking)">Cancel</button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty-msg">No confirmed bookings yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- EMAIL PREVIEW MODAL -->
      @if (previewBooking()) {
        <div class="modal-overlay">
          <div class="modal-content">
            <h3>Review & Edit Confirmation Email</h3>
            <p class="modal-intro">Modify message for <strong>{{ previewBooking()?.customerEmail }}</strong>:</p>
            
            <div class="email-preview-box">
              <div class="preview-row"><strong>To:</strong> {{ previewBooking()?.customerEmail }}</div>
              <div class="preview-row"><strong>Subject:</strong> YOUR BOOKING IS CONFIRMED</div>
              <hr>
              <textarea 
                [(ngModel)]="editableBody" 
                class="preview-textarea" 
                rows="10"
              ></textarea>
            </div>

            <div class="modal-footer">
              <button class="cancel-modal-btn" (click)="previewBooking.set(null)">Go Back</button>
              <button class="send-confirm-btn" (click)="finalizeConfirmation()" [disabled]="processing()">
                {{ processing() ? 'Sending...' : 'Send Email' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  </div>
  `,
  styles: [`
    .admin-page-wrapper { background-color: #f8f0ff; min-height: 100vh; margin-top: -1.5rem; padding-top: 1.5rem; }
    .admin-container { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: sans-serif; color: #4a4a4a; }
    
    @media (max-width: 600px) {
      .admin-container { padding: 10px; }
    }

    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ffe4e8; padding-bottom: 1rem; margin-bottom: 1rem; }
    h1, h2, h3 { color: #d63384; }
    .logout-btn { padding: 6px 12px; background: #8a6d71; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }

    .summary-bar { display: flex; gap: 15px; margin-bottom: 2rem; }
    .summary-item { flex: 1; padding: 15px; border-radius: 12px; background: white; text-align: center; box-shadow: 0 4px 10px rgba(214, 51, 132, 0.05); display: flex; flex-direction: column; }
    .summary-item .count { font-size: 1.5rem; font-weight: 800; line-height: 1; margin-bottom: 4px; }
    .summary-item .label { font-size: 0.75rem; text-transform: uppercase; font-weight: bold; opacity: 0.7; }
    
    .summary-item.pending { color: #856404; border-bottom: 4px solid #ffc107; }
    .summary-item.confirmed { color: #d63384; border-bottom: 4px solid #d63384; }
    .summary-item.open { color: #155724; border-bottom: 4px solid #28a745; }

    @media (max-width: 600px) {
      .summary-bar { flex-wrap: wrap; }
      .summary-item { min-width: 100px; }
    }

    .dashboard-layout { display: grid; grid-template-columns: 1fr 350px; gap: 30px; margin-bottom: 3rem; }

    @media (max-width: 1000px) {
      .dashboard-layout { grid-template-columns: 1fr; gap: 20px; }
      .header { flex-direction: column; gap: 10px; text-align: center; }
    }

    .calendar-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .calendar-controls button { border: 1px solid #ffe4e8; background: white; color: #d63384; padding: 5px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    
    .calendar-grid { background: #fff; display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #ffe4e8; border-radius: 12px; overflow: hidden; }
    .weekday { background: #fff0f3; padding: 10px; text-align: center; font-weight: bold; font-size: 0.8rem; border-bottom: 1px solid #ffe4e8; color: #d63384; }
    .calendar-day { min-height: 80px; padding: 10px; border-right: 1px solid #fff0f3; border-bottom: 1px solid #fff0f3; cursor: pointer; transition: background 0.2s; position: relative; }
    
    @media (max-width: 600px) {
      .calendar-day { min-height: 60px; padding: 5px; }
      .weekday { padding: 5px; font-size: 0.7rem; }
    }

    .calendar-day:hover { background: #fff0f3; }
    .calendar-day.selected { border: 2px solid #d63384; background: #fff0f3; z-index: 1; }
    .day-number { font-weight: bold; color: #8a6d71; }
    .day-indicators { display: flex; gap: 4px; margin-top: 10px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.open { background: #28a745; }
    .dot.closed { background: #dc3545; }
    .dot.booked { background: #d63384; }
    .dot.pending { background: #ffc107; }
    .hint { font-size: 0.8rem; color: #8a6d71; margin-top: 10px; font-style: italic; }

    .detail-panel { background: #fff; border: 1px solid #ffe4e8; border-radius: 12px; padding: 20px; box-shadow: 0 4px 15px rgba(214, 51, 132, 0.05); }
    .slot-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 12px; border-bottom: 1px solid #fff0f3; margin-bottom: 10px; border-radius: 6px; gap: 10px; }
    
    @media (max-width: 500px) {
      .slot-row { flex-direction: column; }
      .slot-actions { width: 100%; display: flex; justify-content: flex-end; padding-top: 10px; border-top: 1px dashed #eee; }
    }

    .slot-row.open { background: #f4fff6; }
    .slot-row.closed { background: #fce8e8; }
    .slot-row.booked { background: #fff0f3; }
    .slot-row.pending { background: #fff9db; }

    .slot-time-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .slot-booking-details { font-size: 0.85rem; color: #4a4a4a; margin-top: 5px; background: rgba(255, 255, 255, 0.5); padding: 8px; border-radius: 4px; }
    .customer-email { color: #8a6d71; font-size: 0.75rem; }
    .customer-notes { font-style: italic; font-size: 0.75rem; margin-top: 4px; color: #d63384; }

    .status-group { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .mini-confirm-btn { background: #d63384; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: bold; }
    
    .status-text { font-size: 0.75rem; text-transform: uppercase; color: #8a6d71; font-weight: bold; }
    .status-badge { font-weight: bold; font-size: 0.8rem; padding: 4px 8px; border-radius: 4px; }
    .status-badge.booked { color: #d63384; background: #fff0f3; }
    .status-badge.pending { color: #856404; background: #fff3cd; }

    .slot-toggle-btn { background: white; border: 1px solid #d63384; color: #d63384; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
    .direct-book-btn { background: #28a745; border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; margin-right: 5px; }
    
    .add-slot-form { display: flex; align-items: center; gap: 8px; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ffe4e8; }
    .time-select { padding: 6px; border: 1px solid #ffe4e8; border-radius: 4px; color: #d63384; font-weight: bold; background: white; cursor: pointer; }
    .colon { font-weight: bold; color: #d63384; }
    .toggle-period-btn { background: #fff0f3; border: 1px solid #d63384; color: #d63384; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; min-width: 45px; }
    .add-btn { background: #8a6d71; color: white; border: none; padding: 7px 15px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: bold; }
    .add-btn:hover { background: #7a5d61; }

    .open-day-btn { width: 100%; padding: 15px; background: #d63384; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .danger-btn { margin-top: 20px; width: 100%; background: none; color: #dc3545; border: 1px solid #dc3545; padding: 8px; border-radius: 4px; cursor: pointer; }

    .bookings-section { margin-top: 2rem; }
    .pending-section { border: 2px solid #ffc107; border-radius: 10px; padding: 15px; background: #fffdf5; }
    .table-container { border: 1px solid #ffe4e8; border-radius: 8px; overflow-x: auto; margin-top: 10px; background: white; }
    table { width: 100%; border-collapse: collapse; min-width: 800px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #fff0f3; }
    th { background: #fff0f3; color: #d63384; }
    .email-sub { font-size: 0.75rem; color: #8a6d71; }
    .comment-cell { font-size: 0.85rem; color: #4a4a4a; max-width: 200px; }
    
    .confirm-action-btn { background: #d63384; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-weight: 600; }
    .decline-action-btn { background: #8a6d71; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .cancel-btn { color: #dc3545; background: none; border: none; cursor: pointer; text-decoration: underline; }

    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(214, 51, 132, 0.2); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 600px; width: 95%; box-shadow: 0 10px 25px rgba(214, 51, 132, 0.15); max-height: 90vh; overflow-y: auto; border: 1px solid #ffe4e8; }
    
    @media (max-width: 600px) {
      .modal-footer { flex-direction: column; }
      .modal-footer button { width: 100%; }
    }

    .email-preview-box { background: #fff0f3; border: 1px solid #ffe4e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .preview-row { margin-bottom: 5px; font-size: 0.9rem; color: #d63384; }
    .preview-textarea { width: 100%; padding: 10px; border: 1px solid #ffe4e8; border-radius: 4px; font-family: sans-serif; font-size: 0.9rem; line-height: 1.5; box-sizing: border-box; resize: vertical; min-height: 200px; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 15px; }
    .cancel-modal-btn { background: #eee; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; color: #8a6d71; }
    .send-confirm-btn { background: #d63384; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .send-confirm-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; font-size: 0.85rem; font-weight: bold; margin-bottom: 5px; color: #d63384; }
    .form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ffe4e8; border-radius: 6px; box-sizing: border-box; }
  `]
})
export class AdminView {
  bookingService = inject(BookingService);
  auth = inject(AuthService);
  
  viewDate = signal(new Date());
  selectedDate = signal<string | null>(null);
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Modal State
  previewBooking = signal<Booking | null>(null);
  editableBody = signal('');
  processing = signal(false);

  // New Slot State
  newSlotHour = signal('10');
  newSlotMin = signal('00');
  newSlotPeriod = signal<'AM' | 'PM'>('AM');

  // Direct Booking State
  directBookingSlot = signal<SlotTime | null>(null);
  manualName = signal('');
  manualEmail = signal('');
  manualPhone = signal('');
  manualPeople = signal(1);
  manualComments = signal('');

  pendingBookings = computed(() => {
    return this.bookingService.allBookings()
      .filter(b => b.status === 'pending')
      .sort((a, b) => this.compareBookings(a, b));
  });

  confirmedBookings = computed(() => {
    return this.bookingService.allBookings()
      .filter(b => b.status === 'confirmed')
      .sort((a, b) => this.compareBookings(a, b));
  });

  totalOpenSlots = computed(() => {
    return this.bookingService.daySchedules()
      .reduce((acc, day) => acc + day.slots.filter(s => s.status === 'open').length, 0);
  });

  private compareBookings(a: Booking, b: Booking) {
    const timeA = this.parseTime(a.slot);
    const timeB = this.parseTime(b.slot);
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return timeA - timeB;
  }

  private parseTime(timeStr: string): number {
    const [time, modifier] = (timeStr || '12:00 AM').split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + (minutes || 0);
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

  changeMonth(delta: number) {
    const current = this.viewDate();
    this.viewDate.set(new Date(current.getFullYear(), current.getMonth() + delta, 1));
    this.selectedDate.set(null);
  }

  selectDay(dateStr: string) {
    this.selectedDate.set(dateStr);
  }

  async toggleDayStatus(dateStr: string) {
    try {
      await this.bookingService.toggleDay(dateStr);
    } catch (e: any) {
      if (e.message === 'CANCEL_USER') {
        alert('You cannot block this day because it already contains active bookings. Please cancel/decline them first.');
      } else {
        alert('Error: ' + e.message);
      }
    }
  }

  getDaySchedule(dateStr: string) {
    return this.bookingService.daySchedules().find(d => d.date === dateStr);
  }

  getBookingForSlot(date: string, time: string): Booking | undefined {
    return this.bookingService.allBookings().find(b => b.date === date && b.slot === time);
  }

  async toggleSlot(slot: any) {
    const nextStatus = slot.status === 'open' ? 'closed' : 'open';
    await this.bookingService.updateSlotStatus(this.selectedDate()!, slot.time, nextStatus);
  }

  togglePeriod() {
    this.newSlotPeriod.set(this.newSlotPeriod() === 'AM' ? 'PM' : 'AM');
  }

  async addNewSlot() {
    const date = this.selectedDate();
    if (!date) return;
    
    const time = `${this.newSlotHour()}:${this.newSlotMin()} ${this.newSlotPeriod()}`;
    
    try {
      await this.bookingService.addSlot(date, time);
    } catch (e: any) {
      alert(e.message);
    }
  }

  openDirectBooking(slot: SlotTime) {
    this.directBookingSlot.set(slot);
    this.manualName.set('');
    this.manualEmail.set('');
    this.manualPhone.set('');
    this.manualPeople.set(1);
    this.manualComments.set('Added manually (e.g. Phone/FB)');
  }

  closeDirectBooking() {
    this.directBookingSlot.set(null);
  }

  async confirmDirectBooking() {
    const date = this.selectedDate();
    const slot = this.directBookingSlot();
    if (!date || !slot) return;

    this.processing.set(true);
    try {
      await this.bookingService.addManualBooking({
        date,
        slot,
        customerName: this.manualName(),
        customerEmail: this.manualEmail(),
        customerPhone: this.manualPhone(),
        numberOfPeople: this.manualPeople(),
        comments: this.manualComments()
      });
      this.closeDirectBooking();
      alert('Direct booking added successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      this.processing.set(false);
    }
  }

  async cancelBookingWithAlert(booking: Booking) {
    const contactInfo = booking.customerEmail + (booking.customerPhone ? ' / ' + booking.customerPhone : '');
    const msg = `Are you sure you want to cancel this booking?\n\n` +
                `Please get in touch with ${booking.customerName} (${contactInfo}) ` +
                `to let them know you've cancelled, if this cancellation was not customer initiated.`;
    
    if (confirm(msg)) {
      await this.bookingService.cancelBooking(booking.id);
    }
  }

  openPreview(booking: Booking) {
    this.previewBooking.set(booking);
    this.editableBody.set(this.bookingService.getConfirmationEmailTemplate(booking));
  }

  async finalizeConfirmation() {
    const b = this.previewBooking();
    if (!b) return;

    this.processing.set(true);
    try {
      await this.bookingService.confirmBooking(b.id, this.editableBody());
      this.previewBooking.set(null); 
      alert('Booking confirmed and email sent!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      this.processing.set(false);
    }
  }
}
