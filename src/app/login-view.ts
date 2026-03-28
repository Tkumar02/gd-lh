import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <h2>Owner Login</h2>
      <div class="form-group">
        <label>Email:</label>
        <input type="email" [(ngModel)]="email" placeholder="Email" />
      </div>
      <div class="form-group">
        <label>Password:</label>
        <input type="password" [(ngModel)]="password" placeholder="Password" />
      </div>
      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      <button (click)="login()" [disabled]="loading()">
        {{ loading() ? 'Logging in...' : 'Login' }}
      </button>
    </div>
  `,
  styles: [`
    .login-container { max-width: 400px; margin: 100px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; }
    .form-group input { width: 100%; padding: 8px; box-sizing: border-box; }
    .error { color: red; margin-bottom: 10px; }
    button { width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
  `]
})
export class LoginView {
  private authService = inject(AuthService);
  email = signal('');
  password = signal('');
  error = signal('');
  loading = signal(false);

  async login() {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.login(this.email(), this.password());
    } catch (e: any) {
      this.error.set(e.message);
    } finally {
      this.loading.set(false);
    }
  }
}
