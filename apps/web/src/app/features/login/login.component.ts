import { DocumentDirective } from '../../core/document.directive';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login', standalone: true, imports: [FormsModule, RouterLink, DocumentDirective],
  templateUrl: './login.component.html', styleUrl: './login.component.scss',
})
export class LoginComponent {
  cnpj = '';
  platform = false;
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  constructor(public readonly auth: AuthService, private readonly router: Router) { this.platform = router.url.startsWith('/plataforma'); }
  submit() {
    if (this.loading()) return;
    this.loading.set(true); this.error.set('');
    this.auth.login(this.email, this.password, this.cnpj, this.platform).subscribe({
      next: () => { this.password = ''; void this.router.navigate([this.auth.home()]); },
      error: (error) => { this.loading.set(false); this.error.set(error.error?.message ?? 'Não foi possível entrar'); },
    });
  }
}
