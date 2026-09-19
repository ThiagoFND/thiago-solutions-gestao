import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({ selector: 'app-home', standalone: true, template: '<div class="loading">Abrindo sua área...</div>', styles: ['.loading{padding:40px;color:#64748b}'] })
export class HomeComponent implements OnInit {
  constructor(private readonly auth: AuthService, private readonly router: Router) {}
  ngOnInit() {
    void this.router.navigate([this.auth.home()]);
  }
}
