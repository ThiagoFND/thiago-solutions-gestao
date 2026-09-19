import { AuthService } from '../../core/auth.service';
import { PermissionDirective } from '../../core/permission.directive';
import { FiscalSalesComponent } from './fiscal-sales.component';
import { AttachmentsComponent } from './attachments.component';
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NumericInputDirective } from '../../core/numeric-input.directive';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Product } from '../../core/models';
import { FinanceService } from './finance.service';
import { Category, Entry, History, Page, Recurrence, Summary, moneyInput, today } from './finance.models';
const blankPage = <T>(): Page<T> => ({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
@Component({ selector: 'app-finance', standalone: true, imports: [PermissionDirective,CommonModule, FormsModule, NumericInputDirective, FiscalSalesComponent, AttachmentsComponent], templateUrl: './finance.component.html', styleUrl: './finance.component.scss' })
export class FinanceComponent implements OnInit {
  readonly tabs = ['Resumo', 'Contas', 'Nova conta', 'Categorias', 'Recorrências', 'Vendas para emissão fiscal'];
  readonly types = ['DESPESA_OPERACIONAL', 'CUSTO_PRODUCAO', 'DESPESA_PESSOAL'];
  readonly natures = ['FIXA', 'VARIAVEL'];
  readonly statuses = ['PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO'];
  readonly methods = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTRO'];
  readonly units = ['KG', 'G', 'L', 'ML', 'UNIDADE', 'CAIXA', 'PACOTE'];
  readonly frequencies = ['SEMANAL', 'MENSAL', 'ANUAL'];
  tab = signal('Resumo'); loading = signal(false); saving = signal(false); error = signal(''); message = signal('');
  summary = signal<Summary | null>(null); entries = signal(blankPage<Entry>()); categories = signal<Category[]>([]); categoryPage = signal(blankPage<Category>()); recurrences = signal(blankPage<Recurrence>()); history = signal(blankPage<History>()); selected = signal<Entry | null>(null);
  products = signal<Pick<Product, '_id' | 'name' | 'active'>[]>([]); month = today().slice(0, 7); generateMonth = this.month; today = today();
  filters: Record<string, string> = { competence: this.month, description: '', dateFrom: '', dateTo: '', dueDate: '', status: '', categoryId: '', type: '', nature: '', origin: '', method: '' };
  catalogActive = ''; catalogType = ''; recurrenceActive = ''; recurrenceType = '';
  editing: Entry | Recurrence | null = null; editingRecurrence = false; form = this.emptyForm();
  categoryForm = { name: '', type: 'DESPESA_OPERACIONAL' }; editingCategory: Category | null = null;
  entryCategoryOpen = false; entryCategoryName = ''; entryCategoryError = signal('');
  @ViewChild('entryCategorySelect') entryCategorySelect?: ElementRef<HTMLSelectElement>;
  @ViewChild('entryCategoryInput') set entryCategoryInput(input: ElementRef<HTMLInputElement> | undefined) { input?.nativeElement.focus(); }
  paymentMode = ''; payment = { amount: '', paidOn: today(), origin: 'PJ', method: 'PIX', notes: '', reason: '', confirmed: false };
  cancelReason = '';
  constructor(public readonly auth:AuthService, private readonly api: FinanceService, private readonly coreApi: ApiService) {}
  ngOnInit() { void this.initialize(); }
  async initialize() { await this.read(async () => { const [categories, products, summary] = await Promise.all([this.api.allCategories(), firstValueFrom(this.coreApi.financeProducts()), this.api.summary(this.month)]); this.categories.set(categories); this.products.set(products); this.summary.set(summary); }); }
  async read(work: () => Promise<void>) { this.loading.set(true); this.error.set(''); try { await work(); } catch (e) { this.fail(e); } finally { this.loading.set(false); } }
  async mutate(work: () => Promise<void>, success: string) { if (this.saving()) return; this.saving.set(true); this.error.set(''); this.message.set(''); try { await work(); if (success) this.message.set(success); } catch (e) { this.fail(e); } finally { this.saving.set(false); } }
  fail(e: unknown) { const err = e as { error?: { message?: string | string[] }; message?: string }; const message = err.error?.message ?? err.message ?? 'Não foi possível concluir. Tente novamente.'; this.error.set(Array.isArray(message) ? message.join(' ') : message); }
  async switchTab(tab: string) { this.tab.set(tab); this.selected.set(null); this.paymentMode = ''; this.message.set(''); if (tab === 'Nova conta') this.resetForm(); await this.load(); }
  async load(page = 1) { await this.read(async () => {
    if (this.tab() === 'Resumo') this.summary.set(await this.api.summary(this.month));
    if (this.tab() === 'Contas') this.entries.set(await this.api.entries({ ...this.filters, page, limit: 20 }));
    if (this.tab() === 'Categorias') this.categoryPage.set(await this.api.categories({ page, limit: 20, active: this.catalogActive, type: this.catalogType }));
    if (this.tab() === 'Recorrências') this.recurrences.set(await this.api.recurrences({ page, limit: 20, active: this.recurrenceActive, type: this.recurrenceType }));
  }); }
  clearFilters() { for (const key of Object.keys(this.filters)) this.filters[key] = ''; void this.load(); }
  label(value: string) { return ({ DESPESA_OPERACIONAL: 'Despesa operacional', DESPESA_PESSOAL: 'Despesa pessoal', PERSONAL_EXPENSE: 'Despesa pessoal', CUSTO_PRODUCAO: 'Custo de produção', FIXA: 'Fixa', VARIAVEL: 'Variável', PENDENTE: 'Pendente', PAGO: 'Pago', VENCIDO: 'Vencido', CANCELADO: 'Cancelado', DINHEIRO: 'Dinheiro', PIX: 'Pix', DEBITO: 'Débito', CREDITO: 'Crédito', BOLETO: 'Boleto', TRANSFERENCIA: 'Transferência', OUTRO: 'Outro', SEMANAL: 'Semanal', MENSAL: 'Mensal', ANUAL: 'Anual', CRIACAO: 'Criação', EDICAO: 'Edição', PAGAMENTO: 'Pagamento', CORRECAO_PAGAMENTO: 'Correção de pagamento', CANCELAMENTO: 'Cancelamento' } as Record<string, string>)[value] ?? value; }
  money(cents: number | null | undefined) { return cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  decimal(cents?: number) { return cents == null ? '' : (cents / 100).toFixed(2).replace('.', ','); }
  date(value?: string) { return value ? value.split('-').reverse().join('/') : '—'; }
  timestamp(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
  categoryName(id: string) { return this.categories().find(c => c._id === id)?.name ?? id; }
  productName(id?: string) { return id ? this.products().find(p => p._id === id)?.name ?? id : '—'; }
  snapshot(value: unknown): Array<{ label: string; value: string }> {
    if (!value || typeof value !== 'object') return [];
    const labels: Record<string, string> = { description: 'Descrição', categoryId: 'Categoria', type: 'Tipo', nature: 'Natureza', expectedAmountCents: 'Valor previsto', dueDate: 'Vencimento', competence: 'Competência', status: 'Status', supplier: 'Fornecedor', notes: 'Observações', version: 'Versão', recurring: 'Recorrente', installmentNumber: 'Parcela', paidAmountCents: 'Valor pago', paidOn: 'Data real do pagamento', origin: 'Origem', method: 'Forma', registeredAt: 'Registrado em', registeredByName: 'Registrado por', correctedAt: 'Corrigido em', correctedByName: 'Corrigido por', productId: 'Produto', inputName: 'Insumo', quantity: 'Quantidade', unit: 'Unidade', unitAmountCents: 'Valor unitário', totalAmountCents: 'Total do custo' };
    const rows: Array<{ label: string; value: string }> = [];
    for (const [key, raw] of Object.entries(value)) {
      if (key === 'payment' || key === 'production') { for (const row of this.snapshot(raw)) rows.push({ label: `${key === 'payment' ? 'Pagamento' : 'Produção'} · ${row.label}`, value: row.value }); continue; }
      if (!labels[key]) continue;
      const text = raw == null ? '—' : key.endsWith('Cents') ? this.money(Number(raw)) : key === 'categoryId' ? this.categoryName(String(raw)) : key === 'productId' ? this.productName(String(raw)) : ['dueDate', 'paidOn', 'competence'].includes(key) ? this.date(String(raw)) : key.endsWith('At') ? this.timestamp(String(raw)) : typeof raw === 'boolean' ? (raw ? 'Sim' : 'Não') : this.label(String(raw));
      rows.push({ label: labels[key], value: text });
    }
    return rows;
  }
  editable(entry: Entry) { return entry.status === 'PENDENTE' || entry.status === 'VENCIDO'; }
  availableCategories() { return this.categories().filter(c => c.type === this.form.type && (c.active || c._id === this.editing?.categoryId)); }
  defaultEntryKind(type: string) { return type === 'DESPESA_PESSOAL' ? 'PERSONAL_EXPENSE' : type === 'CUSTO_PRODUCAO' ? 'PRODUCTION_COST' : 'OPERATING_EXPENSE'; }
  typeChanged() {
    this.closeEntryCategory();
    this.form.categoryId = '';
    if (this.form.entryKind !== 'RECURRING' && (this.form.type === 'DESPESA_PESSOAL' || this.form.entryKind !== 'INPUT_PURCHASE')) this.form.entryKind = this.defaultEntryKind(this.form.type);
    if (this.form.type === 'DESPESA_PESSOAL') { this.form.purchasedQuantity = ''; this.form.purchasedUnit = ''; }
  }
  emptyForm() { return { entryKind:'OPERATING_EXPENSE',purchaseDate:today(),competenceDate:today(),purchasedQuantity:'',purchasedUnit:'',paid:false,paidOn:today(),paymentMethod:'PIX',paymentOrigin:'PJ', description: '', categoryId: '', type: 'DESPESA_OPERACIONAL', nature: 'FIXA', amount: '', dueDate: today(), competence: today().slice(0, 7), notes: '', supplier: '', recurring: false, frequency: 'MENSAL', startDate: today(), billingDay: Number(today().slice(8)), installments: '', productId: '', inputName: '', quantity: '', unit: '', unitAmount: '', totalAmount: '' }; }
  resetForm() { this.closeEntryCategory(); this.editing = null; this.editingRecurrence = false; this.form = this.emptyForm(); }
  openEntryCategory() { if (this.saving() || this.loading()) return; this.entryCategoryName = ''; this.entryCategoryError.set(''); this.entryCategoryOpen = true; }
  closeEntryCategory() { const wasOpen = this.entryCategoryOpen; this.entryCategoryOpen = false; this.entryCategoryName = ''; this.entryCategoryError.set(''); if (wasOpen) setTimeout(() => this.entryCategorySelect?.nativeElement.focus()); }
  entryCategoryNameValid() { const length = this.entryCategoryName.trim().length; return length >= 2 && length <= 100; }
  async saveEntryCategory() {
    if (this.saving() || this.loading() || !this.entryCategoryOpen) return;
    if (!this.entryCategoryNameValid()) { this.entryCategoryError.set('Informe um nome com 2 a 100 caracteres.'); return; }
    this.saving.set(true); this.entryCategoryError.set(''); this.error.set(''); this.message.set('');
    try {
      const category = await this.api.post<Category>('categories', { name: this.entryCategoryName.trim(), type: this.form.type });
      this.categories.update(categories => [...categories, category]);
      this.form.categoryId = category._id;
      this.closeEntryCategory();
      this.message.set('Categoria cadastrada e selecionada. Continue preenchendo a conta.');
    } catch (e) {
      const err = e as { error?: { message?: string | string[] }; message?: string };
      const message = err.error?.message ?? err.message ?? 'Não foi possível cadastrar a categoria. Tente novamente.';
      this.entryCategoryError.set(Array.isArray(message) ? message.join(' ') : message);
    } finally { this.saving.set(false); }
  }
  edit(entry: Entry | Recurrence, recurrence = false) { this.editing = entry; this.editingRecurrence = recurrence; const r = entry as Recurrence; this.form = { ...this.emptyForm(), entryKind: entry.entryKind ?? ('recurring' in entry && entry.recurring ? 'RECURRING' : this.defaultEntryKind(entry.type)), description: entry.description, categoryId: entry.categoryId, type: entry.type, nature: entry.nature, amount: this.decimal(entry.expectedAmountCents), dueDate: 'dueDate' in entry ? entry.dueDate : today(), competence: 'competence' in entry ? entry.competence : today().slice(0, 7), supplier: entry.supplier ?? '', notes: entry.notes ?? '', recurring: recurrence, frequency: r.frequency ?? 'MENSAL', startDate: r.startDate ?? today(), billingDay: r.billingDay ?? 1, installments: r.installments?.toString() ?? '', productId: entry.production?.productId ?? '', inputName: entry.production?.inputName ?? '', quantity: entry.production?.quantity?.toString() ?? '', unit: entry.production?.unit ?? '', unitAmount: this.decimal(entry.production?.unitAmountCents), totalAmount: this.decimal(entry.production?.totalAmountCents) }; this.tab.set('Nova conta'); this.selected.set(null); this.error.set(''); }
  templateBody() {
    const f = this.form;
    return { description: f.description, categoryId: f.categoryId, type: f.type, nature: f.nature, expectedAmountCents: moneyInput(f.amount), notes: f.notes || null, supplier: f.supplier || null,
      production: f.type === 'CUSTO_PRODUCAO' ? { productId: f.productId || null, inputName: f.inputName || null, quantity: f.quantity ? Number(f.quantity.replace(',', '.')) : null, unit: f.unit || null, unitAmountCents: f.unitAmount ? moneyInput(f.unitAmount) : null, totalAmountCents: f.totalAmount ? moneyInput(f.totalAmount) : null } : null };
  }
  async saveEntry() { if (this.entryCategoryOpen || this.loading() || !this.form.categoryId) return; await this.mutate(async () => {
    const template = this.templateBody(); const f = this.form;
    if (this.editingRecurrence) await this.api.patch(`recurrences/${this.editing!._id}`, { ...template, version: this.editing!.version });
    else if (this.editing) await this.api.patch(`entries/${this.editing._id}`, { ...template, dueDate: f.dueDate, competence: f.competence, entryKind: f.entryKind, version: this.editing.version });
    else if (f.recurring) await this.api.post('recurrences', { ...template, frequency: f.frequency, startDate: f.startDate, ...(f.frequency === 'MENSAL' ? { billingDay: Number(f.billingDay) } : {}), ...(f.installments ? { installments: Number(f.installments) } : {}) });
    else await this.api.post('entries', { ...template, dueDate: f.dueDate || undefined, competence: f.competence,entryKind:f.entryKind,purchaseDate:f.type === 'DESPESA_PESSOAL' ? undefined : f.purchaseDate||undefined,competenceDate:f.competenceDate||undefined,...(f.purchasedQuantity?{quantity:Number(f.purchasedQuantity.replace(',','.')),unit:f.purchasedUnit}:{}),...(f.paid?{initialPayment:{paidAmountCents:moneyInput(f.amount),paidOn:f.paidOn,method:f.paymentMethod,origin:f.paymentOrigin}}:{}) });
    const recurring = this.editingRecurrence || (!this.editing && f.recurring); this.resetForm(); this.tab.set(recurring ? 'Recorrências' : 'Contas'); await this.load();
  }, 'Conta salva. Recorrências geram a primeira competência no cadastro.'); }
  async details(entry: Entry) { this.paymentMode = ''; this.cancelReason = ''; await this.read(async () => { this.selected.set(await this.api.get<Entry>(`entries/${entry._id}`)); this.history.set(await this.api.history(entry._id, 1)); }); }
  async historyPage(page: number) { await this.read(async () => this.history.set(await this.api.history(this.selected()!._id, page))); }
  openPayment(correction = false) { const e = this.selected()!; this.paymentMode = correction ? 'correct' : 'pay'; this.payment = { amount: this.decimal(e.payment?.paidAmountCents ?? e.expectedAmountCents), paidOn: e.payment?.paidOn ?? today(), origin: e.payment?.origin ?? 'PJ', method: e.payment?.method ?? 'PIX', notes: e.payment?.notes ?? '', reason: '', confirmed: false }; }
  async savePayment() { await this.mutate(async () => { const e = this.selected()!; const p = this.payment; const body = { paidAmountCents: moneyInput(p.amount), paidOn: p.paidOn, origin: p.origin, method: p.method, notes: p.notes || null, version: e.version }; const result = this.paymentMode === 'correct' ? await this.api.patch<Entry>(`entries/${e._id}/payment`, { ...body, reason: p.reason, confirmed: p.confirmed }) : await this.api.post<Entry>(`entries/${e._id}/payment`, body); await this.details(result); await this.load(this.entries().page); }, 'Pagamento registrado.'); }
  async cancelEntry() { if (!confirm('Cancelar esta conta? Ela ficará imutável e será excluída dos totais financeiros.')) return; await this.mutate(async () => { const e = this.selected()!; const result = await this.api.post<Entry>(`entries/${e._id}/cancel`, { reason: this.cancelReason, version: e.version }); await this.details(result); await this.load(this.entries().page); }, 'Conta cancelada.'); }
  editCategory(c: Category) { this.editingCategory = c; this.categoryForm = { name: c.name, type: c.type }; }
  resetCategory() { this.editingCategory = null; this.categoryForm = { name: '', type: 'DESPESA_OPERACIONAL' }; }
  async saveCategory() { await this.mutate(async () => { if (this.editingCategory) await this.api.patch(`categories/${this.editingCategory._id}`, this.categoryForm); else await this.api.post('categories', this.categoryForm); this.resetCategory(); this.categories.set(await this.api.allCategories()); await this.load(); }, 'Categoria salva.'); }
  async toggleCategory(c: Category) { if (!confirm(`${c.active ? 'Desativar' : 'Reativar'} a categoria ${c.name}? As contas existentes serão preservadas.`)) return; await this.mutate(async () => { await this.api.patch(`categories/${c._id}`, { active: !c.active }); this.categories.set(await this.api.allCategories()); await this.load(this.categoryPage().page); }, 'Categoria atualizada.'); }
  async toggleRecurrence(r: Recurrence) { if (!confirm(`${r.active ? 'Desativar' : 'Reativar'} esta recorrência? As contas já geradas serão preservadas.`)) return; await this.mutate(async () => { await this.api.patch(`recurrences/${r._id}`, { active: !r.active, version: r.version }); await this.load(this.recurrences().page); }, 'Recorrência atualizada.'); }
  async generate(r: Recurrence) { await this.mutate(async () => { const result = await this.api.post<{ created: number; existing: number }>(`recurrences/${r._id}/generate`, { competence: this.generateMonth }); this.message.set(`${result.created} conta(s) criada(s), ${result.existing} já existente(s). Se ambas forem zero, o mês está fora das ocorrências previstas.`); }, ''); }
}

