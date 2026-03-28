import { Routes } from '@angular/router';
import { BookingView } from './booking-view';
import { AdminView } from './admin-view';
import { LoginView } from './login-view';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', component: BookingView },
  { path: 'login', component: LoginView },
  { path: 'admin', component: AdminView, canActivate: [authGuard] },
];
