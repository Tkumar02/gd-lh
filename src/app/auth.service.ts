import { Injectable, inject, signal } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, user } from '@angular/fire/auth';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);

  readonly user = toSignal(user(this.auth));

  async login(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
      this.router.navigate(['/admin']);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }
}
