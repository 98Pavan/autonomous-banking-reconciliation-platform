'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'
import { AlertCircle, ArrowLeft, ArrowRight, BarChart3, Bell, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3, CloudUpload, Download, FileCheck2, FileText, Filter, Info, LayoutDashboard, Loader2, Menu, Moon, PanelLeftClose, PanelLeftOpen, Play, RefreshCw, RotateCcw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Sun, Table2, Trash2, Upload, UserRound, Users, X, XCircle, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const MANAGER_AGENT_ID = '6af010dd78d9684655581186'
const INVOICE_AGENT_ID = '6af010bd3e6052e6faedb126'
const PAYMENT_AGENT_ID = '6af010c9752c99503d84481d'

const DEFAULT_RULES: RulesApplied = {
  amount_tolerance_percent: 0.5,
  amount_tolerance_cap: 100,
  date_tolerance_days: 3,
  auto_match_confidence: 95,
  human_review_confidence_min: 70,
  sensitive_value_threshold: 100000,
  currency_policy: 'same_currency_only',
  duplicate_detection: 'same reference, amount, currency, and near-date',
}

type Classification = 'exact_match' | 'tolerance_match' | 'suggested_match' | 'exception'
type ApprovalStatus = 'awaiting_human_approval' | 'approved_simulated' | 'rejected_simulated' | 'returned_for_review' | 'not_required'
type Severity = 'low' | 'medium' | 'high' | 'critical'
type Role = 'Analyst' | 'Approver' | 'Auditor'
type ViewKey = 'dashboard' | 'upload' | 'reconciliation' | 'invoice' | 'exceptions' | 'operations' | 'approvals' | 'reports' | 'audit' | 'settings'

interface RulesApplied {
  amount_tolerance_cap: number
  amount_tolerance_percent: number
  auto_match_confidence: number
  currency_policy: 'same_currency_only'
  date_tolerance_days: number
  duplicate_detection: string
  human_review_confidence_min: number
  sensitive_value_threshold: number
}

interface MatchRecord {
  amount_variance: number
  approval_required: boolean
  approval_status: ApprovalStatus
  classification: Classification
  confidence: number
  currency: string
  date_variance_days: number
  invoice_number: string
  match_id: string
  payment_reference: string
  risk_flags: string[]
  rule_evidence: string[]
  source_asset_ids: string[]
}

interface ExceptionRecord {
  approval_required: boolean
  approval_status: 'awaiting_human_approval'
  exception_id: string
  invoice_number: string
  message: string
  payment_reference: string
  reason_code: string
  risk_flags: string[]
  severity: Severity
  suggested_resolution: string
}

interface ApprovalQueueItem {
  case_id: string
  case_type: 'match' | 'exception'
  decision_note_required: boolean
  reason: string
  required_role: string
  risk_level: string
}

interface AuditEvent {
  actor: string
  details: string
  entity_id: string
  event_type: string
}

interface Summary {
  approval_count: number
  currency_breakdown: Array<{ currency: string; value: number }>
  exception_count: number
  invoice_count: number
  matched_count: number
  matched_value: number
  payment_count: number
  reconciliation_rate: number
  suggested_match_count: number
  tolerance_match_count: number
}

interface OrchestratorResult {
  approval_queue: ApprovalQueueItem[]
  audit_events: AuditEvent[]
  exceptions: ExceptionRecord[]
  human_approval_mandatory: boolean
  matches: MatchRecord[]
  rules_applied: RulesApplied
  run_id: string
  sub_agents_used: string[]
  summary: Summary
  synthetic_only: boolean
}

interface Metadata {
  agent_name: string
  timestamp: string
}

interface LocalAuditEvent extends AuditEvent {
  at: string
  origin: 'seeded' | 'captured'
}

interface QueueFile {
  file: File
  source: 'invoice' | 'payment'
  status: 'ready' | 'uploading' | 'uploaded' | 'error'
  message?: string
}

interface ActivityEntry {
  id: string
  title: string
  detail: string
  status: 'complete' | 'active' | 'failed' | 'seeded'
  agent: string
  origin: 'seeded' | 'captured'
}

interface SyntheticDetail {
  vendor: string
  invoiceDate: string
  paymentDate: string
  invoiceAmount: string
  paymentAmount: string
  invoiceStatus: string
  paymentStatus: string
}

const SYNTHETIC_RESULT: OrchestratorResult = {
  run_id: 'RUN-SIM-118',
  matches: [
    { match_id: 'MAT-10482', invoice_number: 'INV-10482', payment_reference: 'PAY-882914', classification: 'exact_match', confidence: 100, amount_variance: 0, date_variance_days: 0, currency: 'USD', rule_evidence: ['Reference agreement', 'Vendor normalization', 'Currency equality', 'Date within policy', 'Amount exact', 'Eligible payment status'], risk_flags: [], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: false, approval_status: 'not_required' },
    { match_id: 'MAT-10491', invoice_number: 'INV-10491', payment_reference: 'PAY-883102', classification: 'tolerance_match', confidence: 97, amount_variance: 42.18, date_variance_days: 1, currency: 'USD', rule_evidence: ['Reference agreement', 'Vendor normalization', 'Currency equality', 'Date within policy', 'Amount within tolerance'], risk_flags: ['date_variance'], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: false, approval_status: 'not_required' },
    { match_id: 'MAT-10503', invoice_number: 'INV-10503', payment_reference: 'PAY-883281', classification: 'suggested_match', confidence: 84, amount_variance: 86.2, date_variance_days: 2, currency: 'USD', rule_evidence: ['Vendor normalization', 'Currency equality', 'Date within policy', 'Amount within tolerance'], risk_flags: ['partial_reference', 'sensitive_value_threshold'], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: true, approval_status: 'awaiting_human_approval' },
    { match_id: 'MAT-10517', invoice_number: 'INV-10517', payment_reference: 'NO_CANDIDATE', classification: 'exception', confidence: 0, amount_variance: 12450, date_variance_days: 0, currency: 'EUR', rule_evidence: ['Required payment reference missing'], risk_flags: ['no_candidate', 'missing_payment'], source_asset_ids: ['synthetic-invoices.csv'], approval_required: true, approval_status: 'awaiting_human_approval' },
    { match_id: 'MAT-10524', invoice_number: 'INV-10524', payment_reference: 'PAY-883402', classification: 'exception', confidence: 61, amount_variance: 0, date_variance_days: 0, currency: 'GBP', rule_evidence: ['Currency equality', 'Amount exact', 'Duplicate detection failed'], risk_flags: ['duplicate_reference'], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: true, approval_status: 'awaiting_human_approval' },
    { match_id: 'MAT-10531', invoice_number: 'INV-10531', payment_reference: 'PAY-883511', classification: 'tolerance_match', confidence: 96, amount_variance: 18.5, date_variance_days: 2, currency: 'USD', rule_evidence: ['Reference agreement', 'Vendor normalization', 'Currency equality', 'Date within policy', 'Amount within tolerance'], risk_flags: ['date_variance'], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: false, approval_status: 'not_required' },
    { match_id: 'MAT-10542', invoice_number: 'INV-10542', payment_reference: 'PAY-883602', classification: 'exact_match', confidence: 100, amount_variance: 0, date_variance_days: 0, currency: 'EUR', rule_evidence: ['Reference agreement', 'Vendor normalization', 'Currency equality', 'Date within policy', 'Amount exact', 'Eligible payment status'], risk_flags: [], source_asset_ids: ['synthetic-invoices.csv', 'synthetic-payments.csv'], approval_required: false, approval_status: 'not_required' },
  ],
  exceptions: [
    { exception_id: 'EXC-10517', invoice_number: 'INV-10517', payment_reference: 'NO_CANDIDATE', reason_code: 'missing_payment', severity: 'high', message: 'No eligible payment candidate was found for the invoice amount and currency.', suggested_resolution: 'Confirm whether the payment source is complete, then add or correct the payment reference in this session.', risk_flags: ['no_candidate', 'missing_payment'], approval_required: true, approval_status: 'awaiting_human_approval' },
    { exception_id: 'EXC-10524', invoice_number: 'INV-10524', payment_reference: 'PAY-883402', reason_code: 'duplicate_reference', severity: 'critical', message: 'Two payment rows share the same reference, amount, currency, and near-date window.', suggested_resolution: 'Review duplicate payment evidence and route the case to a simulated approver before any classification change.', risk_flags: ['duplicate_reference', 'policy_breach'], approval_required: true, approval_status: 'awaiting_human_approval' },
  ],
  approval_queue: [
    { case_id: 'MAT-10503', case_type: 'match', reason: 'Suggested match exceeds the sensitive-value threshold.', risk_level: 'high', required_role: 'Approver', decision_note_required: true },
    { case_id: 'EXC-10517', case_type: 'exception', reason: 'No eligible payment candidate.', risk_level: 'high', required_role: 'Approver', decision_note_required: true },
    { case_id: 'EXC-10524', case_type: 'exception', reason: 'Duplicate payment reference cluster.', risk_level: 'critical', required_role: 'Approver', decision_note_required: true },
    { case_id: 'MAT-10524', case_type: 'match', reason: 'Exception classification requires human review.', risk_level: 'critical', required_role: 'Approver', decision_note_required: true },
  ],
  summary: { invoice_count: 7, payment_count: 6, matched_count: 4, tolerance_match_count: 2, suggested_match_count: 1, exception_count: 2, approval_count: 4, matched_value: 744300.5, currency_breakdown: [{ currency: 'USD', value: 197080.5 }, { currency: 'EUR', value: 4280 }, { currency: 'GBP', value: 7920 }], reconciliation_rate: 85.7 },
  rules_applied: DEFAULT_RULES,
  sub_agents_used: ['Invoice Extraction Agent', 'Payment Extraction Agent'],
  synthetic_only: true,
  human_approval_mandatory: true,
  audit_events: [
    { event_type: 'SAMPLE_PACK_LOADED', actor: 'Session user', entity_id: 'RUN-SIM-118', details: 'Synthetic invoice and payment demonstration records loaded.' },
    { event_type: 'EXTRACTION_COMPLETED', actor: 'Invoice Extraction Agent', entity_id: 'RUN-SIM-118', details: '7 synthetic invoice records normalized with 1 missing-candidate flag.' },
    { event_type: 'EXTRACTION_COMPLETED', actor: 'Payment Extraction Agent', entity_id: 'RUN-SIM-118', details: '6 synthetic payment records normalized with 1 duplicate cluster.' },
    { event_type: 'MATCH_CLASSIFIED', actor: 'Reconciliation Orchestrator', entity_id: 'RUN-SIM-118', details: 'Results classified using the session tolerance policy.' },
    { event_type: 'APPROVAL_QUEUE_CREATED', actor: 'Reconciliation Orchestrator', entity_id: 'RUN-SIM-118', details: '4 cases routed to the simulated approval queue.' },
  ],
}

const SYNTHETIC_METADATA: Metadata = { agent_name: 'Reconciliation Orchestrator', timestamp: '08 Nov 2026, 10:42 UTC' }

const SYNTHETIC_DETAILS: Record<string, SyntheticDetail> = {
  'INV-10482': { vendor: 'Northstar Systems', invoiceDate: '18 Oct 2026', paymentDate: '18 Oct 2026', invoiceAmount: 'USD 42,180.00', paymentAmount: 'USD 42,180.00', invoiceStatus: 'Approved', paymentStatus: 'Settled · synthetic' },
  'INV-10491': { vendor: 'Meridian Data Ltd', invoiceDate: '19 Oct 2026', paymentDate: '20 Oct 2026', invoiceAmount: 'USD 18,420.00', paymentAmount: 'USD 18,377.82', invoiceStatus: 'Approved', paymentStatus: 'Settled · synthetic' },
  'INV-10503': { vendor: 'Atlas Infrastructure', invoiceDate: '18 Oct 2026', paymentDate: '20 Oct 2026', invoiceAmount: 'USD 126,840.00', paymentAmount: 'USD 126,753.80', invoiceStatus: 'Approved', paymentStatus: 'Settled · synthetic' },
  'INV-10517': { vendor: 'Blue Peak Advisory', invoiceDate: '21 Oct 2026', paymentDate: 'Not available', invoiceAmount: 'EUR 12,450.00', paymentAmount: 'Not available', invoiceStatus: 'Approved', paymentStatus: 'No candidate' },
  'INV-10524': { vendor: 'Crownline Services', invoiceDate: '21 Oct 2026', paymentDate: '21 Oct 2026', invoiceAmount: 'GBP 7,920.00', paymentAmount: 'GBP 7,920.00', invoiceStatus: 'Approved', paymentStatus: 'Settled · duplicate reference' },
  'INV-10531': { vendor: 'Harbour Technology', invoiceDate: '22 Oct 2026', paymentDate: '24 Oct 2026', invoiceAmount: 'USD 9,640.50', paymentAmount: 'USD 9,622.00', invoiceStatus: 'Approved', paymentStatus: 'Settled · synthetic' },
  'INV-10542': { vendor: 'Sterling Office Group', invoiceDate: '22 Oct 2026', paymentDate: '22 Oct 2026', invoiceAmount: 'EUR 4,280.00', paymentAmount: 'EUR 4,280.00', invoiceStatus: 'Approved', paymentStatus: 'Settled · synthetic' },
}

const VIEW_LABELS: Record<ViewKey, string> = {
  dashboard: 'Executive Dashboard',
  upload: 'File Upload',
  reconciliation: 'Reconciliation Centre',
  invoice: 'Invoice Processing',
  exceptions: 'Exception Management',
  operations: 'AI Agent Operations',
  approvals: 'Approval Centre',
  reports: 'Reports & Analytics',
  audit: 'Audit History',
  settings: 'Settings',
}

const NAV_GROUPS: Array<{ label: string; items: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard; count?: string }> }> = [
  { label: 'Overview', items: [{ key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard }, { key: 'upload', label: 'File Upload', icon: CloudUpload }, { key: 'reconciliation', label: 'Reconciliation Centre', icon: Table2 }, { key: 'invoice', label: 'Invoice Processing', icon: FileCheck2 }] },
  { label: 'Operations', items: [{ key: 'exceptions', label: 'Exception Management', icon: CircleAlert, count: '2' }, { key: 'operations', label: 'AI Agent Operations', icon: Bot }, { key: 'approvals', label: 'Approval Centre', icon: ShieldCheck, count: '4' }] },
  { label: 'Governance', items: [{ key: 'reports', label: 'Reports & Analytics', icon: BarChart3 }, { key: 'audit', label: 'Audit History', icon: ClipboardList }, { key: 'settings', label: 'Settings', icon: Settings2 }] },
]

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="mt-3 text-sm font-semibold">{line.slice(4)}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="mt-3 text-base font-semibold">{line.slice(3)}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="mt-4 text-lg font-bold">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part)
}

function isOrchestratorResult(value: unknown): value is OrchestratorResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<OrchestratorResult>
  return Array.isArray(candidate.matches) && Array.isArray(candidate.exceptions) && Array.isArray(candidate.approval_queue) && Array.isArray(candidate.audit_events) && Array.isArray(candidate.sub_agents_used) && typeof candidate.run_id === 'string' && typeof candidate.synthetic_only === 'boolean' && typeof candidate.human_approval_mandatory === 'boolean' && Boolean(candidate.summary) && Boolean(candidate.rules_applied)
}

function formatCurrency(value: number, currency = 'USD') {
  if (!Number.isFinite(value)) return `${currency} —`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
}

function titleForClassification(value: Classification) {
  if (value === 'exact_match') return 'Exact match'
  if (value === 'tolerance_match') return 'Tolerance match'
  if (value === 'suggested_match') return 'Suggested match'
  return 'Exception'
}

function statusTone(value: Classification | Severity | ApprovalStatus) {
  if (value === 'exact_match' || value === 'approved_simulated' || value === 'not_required' || value === 'low') return 'green'
  if (value === 'tolerance_match' || value === 'returned_for_review' || value === 'medium') return 'blue'
  if (value === 'suggested_match' || value === 'awaiting_human_approval' || value === 'high') return 'amber'
  return 'red'
}

function localAudit(event_type: string, actor: string, entity_id: string, details: string, origin: 'seeded' | 'captured' = 'captured'): LocalAuditEvent {
  return { event_type, actor, entity_id, details, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), origin }
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function ButtonIcon({ children, label, onClick, disabled = false }: { children: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="h-10 w-10 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{children}</Button>
}

function StatusBadge({ label, tone, icon }: { label: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'; icon?: React.ReactNode }) {
  const classes = tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300' : tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300' : tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300' : tone === 'red' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' : 'border-border bg-muted text-muted-foreground'
  return <Badge variant="outline" className={`gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${classes}`}>{icon}{label}</Badge>
}

function EmptyState({ title, description, actionLabel, onAction, icon = <FileText className="h-5 w-5" /> }: { title: string; description: string; actionLabel?: string; onAction?: () => void; icon?: React.ReactNode }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">{icon}</div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>{actionLabel && onAction && <Button type="button" size="sm" onClick={onAction} className="mt-4 rounded-lg">{actionLabel}</Button>}</div>
}

function ActivityPanel({ entries, processing, activeAgent, activeAgentId }: { entries: ActivityEntry[]; processing: boolean; activeAgent: string; activeAgentId: string }) {
  return <Card className="overflow-hidden rounded-xl border-border/70 shadow-sm"><CardHeader className="border-b border-border/70 bg-card pb-3"><div className="flex items-center justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-sm"><Bot className="h-4 w-4 text-primary" /> Agent activity</CardTitle><CardDescription className="mt-1 text-[11px]">Captured runtime events and seeded demonstration events.</CardDescription></div><StatusBadge label={processing ? 'Processing' : 'Ready'} tone={processing ? 'blue' : 'green'} icon={processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} /></div></CardHeader><CardContent className="p-0"><div className="border-b border-border/70 bg-muted/30 px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${processing ? 'bg-blue-500' : 'bg-emerald-500'}`} />{processing ? activeAgent : 'No agent currently running'}</div><p className="mt-1 text-[11px] text-muted-foreground">Live connection is active only while a manager run is processing.</p>{activeAgentId && <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Session agent ID · {activeAgentId}</p>}</div><div className="max-h-[420px] overflow-y-auto">{entries.length === 0 ? <div className="p-6 text-center text-xs text-muted-foreground">No agent events yet. Load the sample pack or run a reconciliation.</div> : entries.map(entry => <div key={entry.id} className="flex gap-3 border-b border-border/60 px-4 py-3 last:border-0"><div className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${entry.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : entry.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : entry.status === 'seeded' ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>{entry.status === 'active' ? <Loader2 className="h-3 w-3 animate-spin" /> : entry.status === 'failed' ? <XCircle className="h-3 w-3" /> : entry.status === 'seeded' ? <Info className="h-3 w-3" /> : <Check className="h-3 w-3" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{entry.title}</p><Badge variant="outline" className="px-1.5 py-0 text-[9px]">{entry.origin}</Badge></div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{entry.detail}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{entry.agent}</p></div></div>)}</div></CardContent></Card>
}

function PolicyStrip({ rules }: { rules: RulesApplied }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/30 px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" />Active policy <span className="font-normal text-muted-foreground">Rules-based tolerance v3</span></div><div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground"><span className="rounded-md border border-border bg-card px-2 py-1">Amount ≤ {rules.amount_tolerance_percent.toFixed(2)}%</span><span className="rounded-md border border-border bg-card px-2 py-1">Cap {formatCurrency(rules.amount_tolerance_cap)}</span><span className="rounded-md border border-border bg-card px-2 py-1">Date ±{rules.date_tolerance_days} days</span><span className="rounded-md border border-border bg-card px-2 py-1">Same currency</span></div></div>
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p><h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-pretty text-sm text-muted-foreground">{description}</p></div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>
}

function MetricCard({ label, value, detail, tone = 'default', icon }: { label: string; value: string; detail: string; tone?: 'default' | 'danger' | 'warning'; icon: React.ReactNode }) {
  return <Card className="rounded-xl border-border/70 shadow-sm"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p><div className={`grid h-8 w-8 place-items-center rounded-lg ${tone === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : tone === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-primary/10 text-primary'}`}>{icon}</div></div><p className="mt-4 font-serif text-3xl tabular-nums tracking-tight">{value}</p><p className={`mt-1 text-xs ${tone === 'danger' ? 'text-red-700 dark:text-red-300' : tone === 'warning' ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>{detail}</p></CardContent></Card>
}

function SourceField({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2 text-xs last:border-b-0"><span className="text-muted-foreground">{label}</span><strong className="max-w-[62%] text-right font-medium text-foreground">{value}</strong></div>
}

function AgentRoster({ activeAgent, processing }: { activeAgent: string; processing: boolean }) {
  const agents = [{ name: 'Reconciliation Orchestrator', purpose: 'Coordinates extraction, rules, matching, exceptions, and simulated routing.', id: MANAGER_AGENT_ID }, { name: 'Invoice Extraction Agent', purpose: 'Normalizes invoice fields and source evidence.', id: INVOICE_AGENT_ID }, { name: 'Payment Extraction Agent', purpose: 'Normalizes payment fields and duplicate signals.', id: PAYMENT_AGENT_ID }]
  return <Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm">Powering agents</CardTitle><CardDescription className="text-xs">The UI calls only the manager. Delegation is handled by the hosted workflow.</CardDescription></CardHeader><CardContent className="space-y-3">{agents.map(agent => <div key={agent.id} className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"><div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${agent.name === activeAgent && processing ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}>{agent.name === 'Reconciliation Orchestrator' ? <Bot className="h-4 w-4" /> : <Zap className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">{agent.name}</p><span className={`h-1.5 w-1.5 rounded-full ${agent.name === activeAgent && processing ? 'bg-blue-500' : 'bg-emerald-500'}`} /></div><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{agent.purpose}</p><p className="mt-2 truncate font-mono text-[9px] text-muted-foreground">{agent.id}</p></div></div>)}</CardContent></Card>
}

export default function Page() {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [role, setRole] = useState<Role>('Analyst')
  const [darkMode, setDarkMode] = useState(false)
  const [sampleData, setSampleData] = useState(true)
  const [globalSearch, setGlobalSearch] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [agentData, setAgentData] = useState<OrchestratorResult | null>(null)
  const [metadata, setMetadata] = useState<Metadata>(SYNTHETIC_METADATA)
  const [rules, setRules] = useState<RulesApplied>(DEFAULT_RULES)
  const [draftRules, setDraftRules] = useState<RulesApplied>(DEFAULT_RULES)
  const [fileQueue, setFileQueue] = useState<QueueFile[]>([])
  const [sourceType, setSourceType] = useState<'invoice' | 'payment'>('invoice')
  const [selectedMatchId, setSelectedMatchId] = useState('MAT-10503')
  const [selectedExceptionId, setSelectedExceptionId] = useState('EXC-10524')
  const [selectedApprovalId, setSelectedApprovalId] = useState('MAT-10503')
  const [resultFilter, setResultFilter] = useState<'all' | Classification>('all')
  const [exceptionFilter, setExceptionFilter] = useState<'all' | Severity>('all')
  const [resultSearch, setResultSearch] = useState('')
  const [exceptionNotes, setExceptionNotes] = useState<Record<string, string>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})
  const [decisions, setDecisions] = useState<Record<string, { status: ApprovalStatus; note: string }>>({})
  const [decisionDialog, setDecisionDialog] = useState<{ caseId: string; action: 'approve' | 'reject' | 'return' } | null>(null)
  const [decisionNote, setDecisionNote] = useState('')
  const [resetDialog, setResetDialog] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [runState, setRunState] = useState<'idle' | 'processing' | 'completed' | 'error'>('completed')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([
    { id: 'seed-1', title: 'Synthetic sample pack loaded', detail: 'Demonstration records are available for exploration.', status: 'seeded', agent: 'Session workspace', origin: 'seeded' },
    { id: 'seed-2', title: 'Match policy ready', detail: 'Tolerance, duplicate, currency, and approval rules are loaded.', status: 'seeded', agent: 'Session workspace', origin: 'seeded' },
  ])
  const [auditEvents, setAuditEvents] = useState<LocalAuditEvent[]>(SYNTHETIC_RESULT.audit_events.map((event, index) => ({ ...event, at: `10:${38 + index}:0${index}`, origin: 'seeded' })))

  useEffect(() => {
    const storedTheme = window.localStorage.getItem('theme')
    if (storedTheme === 'dark') setDarkMode(true)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    window.localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const data = agentData ?? (sampleData ? SYNTHETIC_RESULT : null)
  const activeRules = data?.rules_applied && agentData ? rules : rules
  const matches = data && Array.isArray(data.matches) ? data.matches : []
  const exceptions = data && Array.isArray(data.exceptions) ? data.exceptions : []
  const approvalQueue = data && Array.isArray(data.approval_queue) ? data.approval_queue : []
  const summary = data?.summary
  const selectedMatch = matches.find(match => match.match_id === selectedMatchId) ?? matches[0] ?? null
  const selectedException = exceptions.find(item => item.exception_id === selectedExceptionId) ?? exceptions[0] ?? null
  const selectedApproval = approvalQueue.find(item => item.case_id === selectedApprovalId) ?? approvalQueue[0] ?? null

  const counts = useMemo(() => ({
    all: matches.length,
    exact_match: matches.filter(match => match.classification === 'exact_match').length,
    tolerance_match: matches.filter(match => match.classification === 'tolerance_match').length,
    suggested_match: matches.filter(match => match.classification === 'suggested_match').length,
    exception: matches.filter(match => match.classification === 'exception').length,
  }), [matches])

  const filteredMatches = useMemo(() => {
    const query = resultSearch.trim().toLowerCase()
    return matches.filter(match => (resultFilter === 'all' || match.classification === resultFilter) && (!query || `${match.invoice_number} ${match.payment_reference} ${match.currency} ${match.match_id}`.toLowerCase().includes(query))).slice(0, 40)
  }, [matches, resultFilter, resultSearch])

  const filteredExceptions = useMemo(() => exceptions.filter(item => exceptionFilter === 'all' || item.severity === exceptionFilter), [exceptions, exceptionFilter])
  const activeAgent = processing ? 'Reconciliation Orchestrator' : '—'

  const appendAudit = (event: LocalAuditEvent) => setAuditEvents(previous => [...previous, event])
  const appendActivity = (entry: Omit<ActivityEntry, 'id'>) => setActivityEntries(previous => [...previous, { ...entry, id: `${entry.origin}-${entry.title}-${previous.length}` }])

  const navigate = (view: ViewKey) => {
    setActiveView(view)
    setMobileNavOpen(false)
    setSuccessMessage('')
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? [])
    if (incoming.length === 0) return
    const accepted: QueueFile[] = []
    incoming.forEach(file => {
      const extension = file.name.toLowerCase().split('.').pop()
      const validExtension = extension === 'csv' || extension === 'xlsx' || extension === 'xls' || extension === 'pdf'
      if (!validExtension) accepted.push({ file, source: sourceType, status: 'error', message: 'Unsupported type. Use CSV, XLSX, or PDF.' })
      else if (file.size > 25 * 1024 * 1024) accepted.push({ file, source: sourceType, status: 'error', message: 'File exceeds the 25 MB session limit.' })
      else accepted.push({ file, source: sourceType, status: 'ready' })
    })
    setFileQueue(previous => [...previous, ...accepted])
    appendAudit(localAudit('FILE_VALIDATED', 'Session user', 'UPLOAD_QUEUE', `${accepted.length} ${sourceType} source file(s) added for session-only validation.`))
    setSuccessMessage(`${accepted.length} file${accepted.length === 1 ? '' : 's'} added to the session queue.`)
    event.target.value = ''
  }

  const loadSamplePack = () => {
    setSampleData(true)
    setAgentData(null)
    setRules(DEFAULT_RULES)
    setDraftRules(DEFAULT_RULES)
    setRunState('completed')
    setError('')
    setSuccessMessage('Synthetic sample pack restored. No files were uploaded.')
    appendActivity({ title: 'Synthetic sample pack restored', detail: 'The demonstration result and default policy are available in browser memory.', status: 'seeded', agent: 'Session workspace', origin: 'seeded' })
    appendAudit(localAudit('SAMPLE_PACK_LOADED', 'Session user', 'RUN-SIM-118', 'Synthetic sample pack restored.'))
  }

  const runReconciliation = async () => {
    setError('')
    setSuccessMessage('')
    const validFiles = fileQueue.filter(item => item.status === 'ready' || item.status === 'uploaded')
    if (validFiles.length === 0) {
      setSampleData(true)
      setAgentData(null)
      setRunState('completed')
      appendActivity({ title: 'Synthetic run ready', detail: 'No uploaded assets were selected; the seeded demonstration result remains active.', status: 'seeded', agent: 'Session workspace', origin: 'seeded' })
      setSuccessMessage('Synthetic demonstration result is ready to review.')
      return
    }

    setUploading(true)
    setProcessing(true)
    setActiveAgentId(MANAGER_AGENT_ID)
    setRunState('processing')
    setFileQueue(previous => previous.map(item => item.status === 'ready' ? { ...item, status: 'uploading' } : item))
    appendActivity({ title: 'Reconciliation Orchestrator started', detail: 'Uploading session assets and loading the current tolerance policy.', status: 'active', agent: 'Reconciliation Orchestrator', origin: 'captured' })
    appendAudit(localAudit('AGENT_RUN_STARTED', 'Reconciliation Orchestrator', 'SESSION', 'Hosted manager run started with uploaded synthetic assets.'))

    try {
      const uploadResult = await uploadFiles(validFiles.map(item => item.file))
      if (!uploadResult.success || !Array.isArray(uploadResult.asset_ids) || uploadResult.asset_ids.length === 0) {
        throw new Error(uploadResult.error ?? uploadResult.message ?? 'The file upload did not return asset IDs.')
      }
      setFileQueue(previous => previous.map(item => item.status === 'uploading' ? { ...item, status: 'uploaded' } : item))
      setUploading(false)
      appendActivity({ title: 'Synthetic assets uploaded', detail: `${uploadResult.successful_uploads} file asset(s) returned to the session.`, status: 'complete', agent: 'Session upload utility', origin: 'captured' })
      appendAudit(localAudit('FILE_UPLOADED', 'Session user', 'UPLOAD_QUEUE', `${uploadResult.successful_uploads} synthetic file asset(s) uploaded through the native upload utility.`))
      const invoiceNames = validFiles.filter(item => item.source === 'invoice').map(item => item.file.name).join(', ') || 'none'
      const paymentNames = validFiles.filter(item => item.source === 'payment').map(item => item.file.name).join(', ') || 'none'
      const message = `Run a synthetic invoice-to-payment reconciliation. Invoice source files: ${invoiceNames}. Payment source files: ${paymentNames}. Apply these exact session rules: amount tolerance ${draftRules.amount_tolerance_percent} percent capped at ${draftRules.amount_tolerance_cap}; date tolerance ${draftRules.date_tolerance_days} calendar days; auto-match confidence ${draftRules.auto_match_confidence} percent; human review minimum ${draftRules.human_review_confidence_min} percent; sensitive value threshold ${draftRules.sensitive_value_threshold}; currency policy same currency only; duplicate detection ${draftRules.duplicate_detection}. Return the exact reconciliation orchestrator response contract. This is simulation-only: do not release funds, alter balances, or post ledger entries.`
      appendActivity({ title: 'Manager delegating extraction', detail: 'The manager is evaluating uploaded invoice and payment sources against the session policy.', status: 'active', agent: 'Reconciliation Orchestrator', origin: 'captured' })
      const result = await callAIAgent(message, MANAGER_AGENT_ID, { assets: uploadResult.asset_ids, session_id: sessionId || undefined })
      if (result.session_id) setSessionId(result.session_id)
      if (!result.success || result.response?.status !== 'success') throw new Error(result.response?.message ?? result.error ?? 'The manager run failed before returning a successful response.')
      const parsed = result.response.result
      if (!isOrchestratorResult(parsed)) throw new Error('The manager returned an incomplete reconciliation response. The declared contract fields are unavailable.')
      const responseMetadata = result.response.metadata
      if (!responseMetadata?.agent_name || !responseMetadata.timestamp) throw new Error('The manager response is missing declared metadata fields.')
      setAgentData(parsed)
      setSampleData(false)
      setRules(parsed.rules_applied)
      setDraftRules(parsed.rules_applied)
      setMetadata({ agent_name: responseMetadata.agent_name, timestamp: responseMetadata.timestamp })
      setRunState('completed')
      appendActivity({ title: 'Reconciliation response received', detail: `${parsed.matches.length} match result(s), ${parsed.exceptions.length} exception(s), and ${parsed.approval_queue.length} approval route(s) returned.`, status: 'complete', agent: 'Reconciliation Orchestrator', origin: 'captured' })
      parsed.sub_agents_used.forEach(agent => appendActivity({ title: `${agent} completed`, detail: 'The manager included this delegated agent in the hosted reconciliation run.', status: 'complete', agent, origin: 'captured' }))
      parsed.audit_events.forEach(event => appendAudit({ ...event, at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), origin: 'captured' }))
      setSuccessMessage('Manager reconciliation completed. The uploaded response is now the active session result.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unknown reconciliation error.'
      setRunState('error')
      setError(message)
      setFileQueue(previous => previous.map(item => item.status === 'uploading' ? { ...item, status: 'error', message: 'Upload or manager run failed; retry this file.' } : item))
      appendActivity({ title: 'Reconciliation run failed', detail: message, status: 'failed', agent: 'Reconciliation Orchestrator', origin: 'captured' })
      appendAudit(localAudit('AGENT_RUN_FAILED', 'Reconciliation Orchestrator', 'SESSION', message))
    } finally {
      setUploading(false)
      setProcessing(false)
      setActiveAgentId('')
    }
  }

  const handleDecision = () => {
    if (!decisionDialog || !decisionNote.trim() || role !== 'Approver') return
    const status: ApprovalStatus = decisionDialog.action === 'approve' ? 'approved_simulated' : decisionDialog.action === 'reject' ? 'rejected_simulated' : 'returned_for_review'
    setDecisions(previous => ({ ...previous, [decisionDialog.caseId]: { status, note: decisionNote.trim() } }))
    appendAudit(localAudit('DECISION_RECORDED', role, decisionDialog.caseId, `${status} recorded with a mandatory decision note. No financial state was changed.`))
    appendActivity({ title: 'Simulated human decision recorded', detail: `${decisionDialog.caseId} marked ${status.replaceAll('_', ' ')} in browser memory only.`, status: 'complete', agent: 'Simulated Approver', origin: 'captured' })
    setDecisionDialog(null)
    setDecisionNote('')
    setSuccessMessage(`Simulated ${decisionDialog.action} recorded for ${decisionDialog.caseId}. No payment, balance, or ledger was changed.`)
  }

  const saveRules = (event: FormEvent) => {
    event.preventDefault()
    setRules(draftRules)
    if (agentData) setAgentData(previous => previous ? { ...previous, rules_applied: draftRules } : previous)
    appendAudit(localAudit('RULE_CHANGED', 'Session user', 'SESSION_POLICY', `Amount tolerance ${draftRules.amount_tolerance_percent.toFixed(2)}%, cap ${draftRules.amount_tolerance_cap}, date window ${draftRules.date_tolerance_days} days.`))
    setSuccessMessage('Session policy updated. Run reconciliation again to apply it to new uploaded assets.')
  }

  const resetWorkspace = () => {
    setAgentData(null)
    setSampleData(true)
    setRules(DEFAULT_RULES)
    setDraftRules(DEFAULT_RULES)
    setFileQueue([])
    setSessionId('')
    setSelectedMatchId('MAT-10503')
    setSelectedExceptionId('EXC-10524')
    setSelectedApprovalId('MAT-10503')
    setDecisions({})
    setCorrections({})
    setExceptionNotes({})
    setError('')
    setRunState('completed')
    setActivityEntries([{ id: 'reset-1', title: 'Workspace reset', detail: 'Synthetic demonstration data and default rules restored.', status: 'seeded', agent: 'Session workspace', origin: 'seeded' }])
    setAuditEvents([localAudit('WORKSPACE_RESET', 'Session user', 'SESSION', 'Uploads, corrections, decisions, and manager session cleared; synthetic defaults restored.', 'captured')])
    setResetDialog(false)
    setSuccessMessage('Synthetic workspace reset. This browser session now contains only demonstration data.')
  }

  const exportResults = () => {
    const rows: string[][] = [['SIMULATED / SYNTHETIC DATA ONLY'], ['Session', sessionId || 'AR-2418'], ['Run', data?.run_id ?? 'none'], ['Disclaimer', 'Not a bank statement, ledger, payment instruction, or accounting record.'], [], ['Match ID', 'Invoice', 'Payment', 'Classification', 'Confidence', 'Amount variance', 'Date variance days', 'Currency', 'Risk flags', 'Rule evidence', 'Source assets', 'Approval required', 'Approval status']]
    matches.forEach(match => rows.push([match.match_id, match.invoice_number, match.payment_reference, match.classification, `${match.confidence}%`, String(match.amount_variance), String(match.date_variance_days), match.currency, match.risk_flags.join(' | '), match.rule_evidence.join(' | '), match.source_asset_ids.join(' | '), String(match.approval_required), match.approval_status]))
    downloadCsv('simulated-reconciliation-results.csv', rows)
    appendAudit(localAudit('REPORT_EXPORTED', 'Session user', data?.run_id ?? 'SESSION', 'Synthetic reconciliation results CSV downloaded.'))
    setSuccessMessage('Synthetic reconciliation CSV downloaded.')
  }

  const exportExceptions = () => {
    const rows: string[][] = [['SIMULATED / SYNTHETIC DATA ONLY'], ['Disclaimer', 'Not a bank statement, ledger, payment instruction, or accounting record.'], [], ['Exception ID', 'Invoice', 'Payment', 'Reason code', 'Severity', 'Message', 'Suggested resolution', 'Risk flags', 'Approval required', 'Approval status']]
    exceptions.forEach(item => rows.push([item.exception_id, item.invoice_number, item.payment_reference, item.reason_code, item.severity, item.message, item.suggested_resolution, item.risk_flags.join(' | '), String(item.approval_required), item.approval_status]))
    downloadCsv('simulated-exception-register.csv', rows)
    appendAudit(localAudit('REPORT_EXPORTED', 'Session user', data?.run_id ?? 'SESSION', 'Synthetic exception register CSV downloaded.'))
    setSuccessMessage('Synthetic exception CSV downloaded.')
  }

  const exportApprovals = () => {
    const rows: string[][] = [['SIMULATED / SYNTHETIC DATA ONLY'], ['Disclaimer', 'No payment, balance, or ledger action is represented.'], [], ['Case ID', 'Case type', 'Reason', 'Risk level', 'Required role', 'Decision note required', 'Recorded status', 'Decision note']]
    approvalQueue.forEach(item => rows.push([item.case_id, item.case_type, item.reason, item.risk_level, item.required_role, String(item.decision_note_required), decisions[item.case_id]?.status ?? 'awaiting_human_approval', decisions[item.case_id]?.note ?? '']))
    downloadCsv('simulated-approval-decision-log.csv', rows)
    appendAudit(localAudit('REPORT_EXPORTED', 'Session user', data?.run_id ?? 'SESSION', 'Synthetic approval decision log CSV downloaded.'))
    setSuccessMessage('Synthetic approval decision log downloaded.')
  }

  const exportAudit = () => {
    const rows: string[][] = [['SIMULATED / SYNTHETIC DATA ONLY'], ['Session', sessionId || 'AR-2418'], ['Disclaimer', 'Session-only audit history; not an accounting record.'], [], ['Time', 'Event type', 'Actor', 'Entity', 'Details', 'Origin']]
    auditEvents.forEach(event => rows.push([event.at, event.event_type, event.actor, event.entity_id, event.details, event.origin]))
    downloadCsv('simulated-audit-history.csv', rows)
    appendAudit(localAudit('REPORT_EXPORTED', 'Session user', 'SESSION', 'Synthetic audit history CSV downloaded.'))
    setSuccessMessage('Synthetic audit history CSV downloaded.')
  }

  const openApprovalDialog = (caseId: string, action: 'approve' | 'reject' | 'return') => {
    setDecisionNote('')
    setDecisionDialog({ caseId, action })
  }

  const renderDashboard = () => {
    if (!data || !summary) return <EmptyState title="No synthetic data is active" description="Turn on Sample Data or load a synthetic sample pack to see the executive operating view." actionLabel="Load sample pack" onAction={loadSamplePack} icon={<LayoutDashboard className="h-5 w-5" />} />
    const matchedRate = formatPercent(summary.reconciliation_rate)
    return <div className="space-y-6"><PageHeader eyebrow="01 / Overview" title="Reconciliation overview" description={`Synthetic operating position for ${data.run_id}. Session-only results are advisory and cannot change financial state.`} actions={<><Button type="button" variant="outline" onClick={() => { window.print(); appendAudit(localAudit('REPORT_OPENED', 'Session user', data.run_id, 'Print-ready synthetic executive summary opened.')) }} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Print summary</Button><Button type="button" onClick={() => navigate('upload')} className="rounded-lg"><Upload className="mr-2 h-4 w-4" />Upload files</Button></>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Reconciliation rate" value={matchedRate} detail={`${summary.matched_count} matched synthetic records`} icon={<CheckCircle2 className="h-4 w-4" />} /><MetricCard label="Matched value" value={formatCurrency(summary.matched_value)} detail={`${summary.invoice_count} invoices · ${summary.payment_count} payments`} icon={<BarChart3 className="h-4 w-4" />} /><MetricCard label="Open exceptions" value={String(summary.exception_count)} detail="Review before simulated routing" tone="danger" icon={<CircleAlert className="h-4 w-4" />} /><MetricCard label="Awaiting approval" value={String(summary.approval_count)} detail={`${data.human_approval_mandatory ? 'Human approval mandatory' : 'Approval optional'}`} tone="warning" icon={<ShieldCheck className="h-4 w-4" />} /></div><div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-start justify-between gap-4 pb-3"><div><CardTitle className="text-sm">Seven-run reconciliation performance</CardTitle><CardDescription className="text-xs">Synthetic demonstration trend · matched versus review workload</CardDescription></div><div className="flex gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Matched</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-400" />Review</span></div></CardHeader><CardContent><div className="flex h-52 items-end gap-3 border-b border-border/70 bg-[linear-gradient(to_top,transparent_24%,hsl(var(--border)/.35)_25%,transparent_26%,transparent_49%,hsl(var(--border)/.35)_50%,transparent_51%,transparent_74%,hsl(var(--border)/.35)_75%,transparent_76%)] px-3 pb-0 pt-5">{[68, 75, 73, 82, 87, 91, Math.min(98, summary.reconciliation_rate)].map((value, index) => <div key={index} className="flex h-full flex-1 items-end justify-center gap-1"><div className="w-[38%] rounded-t-md bg-primary transition-opacity hover:opacity-80" style={{ height: `${value}%` }} /><div className="w-[38%] rounded-t-md bg-amber-300 dark:bg-amber-700" style={{ height: `${Math.max(6, 100 - value)}%` }} /></div>)}</div><div className="mt-3 flex justify-between font-mono text-[9px] uppercase tracking-wide text-muted-foreground"><span>R-112</span><span>R-118 · current</span></div></CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-sm">Priority work queue</CardTitle><CardDescription className="text-xs">Role-aware, simulated next actions</CardDescription></div><StatusBadge label={`${approvalQueue.length + exceptions.length} active`} tone="blue" /></CardHeader><CardContent className="space-y-3">{[{ label: 'High-value approvals', detail: 'Cases above the synthetic threshold', value: approvalQueue.filter(item => item.risk_level === 'high' || item.risk_level === 'critical').length, tone: 'red' as const, view: 'approvals' as ViewKey }, { label: 'Exception investigation', detail: 'Missing candidates and duplicates', value: exceptions.length, tone: 'amber' as const, view: 'exceptions' as ViewKey }, { label: 'Suggested matches', detail: 'Below automatic confidence', value: counts.suggested_match, tone: 'amber' as const, view: 'reconciliation' as ViewKey }, { label: 'Agent processing', detail: runState === 'error' ? 'Retry is available' : 'Manager status for this session', value: runState === 'error' ? 'Retry' : 'Ready', tone: runState === 'error' ? 'red' as const : 'green' as const, view: 'operations' as ViewKey }].map(item => <button key={item.label} type="button" onClick={() => navigate(item.view)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><div><p className="text-xs font-semibold">{item.label}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p></div><StatusBadge label={String(item.value)} tone={item.tone} /></button>)}</CardContent></Card></div><div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]"><AgentRoster activeAgent={activeAgent} processing={processing} /><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm">Session safety boundary</CardTitle><CardDescription className="text-xs">This prototype never connects to payment rails, balances, ledgers, banks, or identity systems.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{['Session-only browser memory', 'Simulated role switcher', 'No financial posting'].map((label, index) => <div key={label} className="rounded-lg border border-border/70 bg-muted/20 p-3"><div className="mb-2 grid h-7 w-7 place-items-center rounded-md bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300">{index === 0 ? <Clock3 className="h-4 w-4" /> : index === 1 ? <Users className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}</div><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">{index === 0 ? 'Refreshing or resetting clears the workspace.' : index === 1 ? 'Analyst, Approver, and Auditor are UI demonstrations.' : 'Approve and reject only update simulated workflow status.'}</p></div>)}</CardContent></Card></div></div>
  }

  const renderUpload = () => <div className="space-y-6"><PageHeader eyebrow="02 / Ingestion" title="New reconciliation run" description="Upload synthetic invoice and payment files, validate them in browser memory, then send their asset IDs to the Reconciliation Orchestrator." actions={<Button type="button" variant="outline" onClick={loadSamplePack} className="rounded-lg"><RefreshCw className="mr-2 h-4 w-4" />Load synthetic sample pack</Button>} /><div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card p-2 sm:grid-cols-4">{['Upload sources', 'Validate records', 'Match & reconcile', 'Review exceptions'].map((step, index) => <div key={step} className={`rounded-lg px-3 py-3 text-center text-xs font-semibold ${index < 3 || runState === 'completed' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}><span className="mr-1 font-mono">0{index + 1}</span>{step}</div>)}</div>{error && <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Upload or manager error</p><p className="mt-1 text-xs">{error}</p></div><ButtonIcon label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></ButtonIcon></div>}{successMessage && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{successMessage}</div>}<div className="grid gap-4 xl:grid-cols-[.85fr_1.4fr]"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Source ingestion</CardTitle><CardDescription className="text-xs">Files are treated as untrusted synthetic text and kept in this session only.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1"><button type="button" onClick={() => setSourceType('invoice')} className={`min-h-10 rounded-md px-3 text-xs font-semibold transition-colors ${sourceType === 'invoice' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Invoice source</button><button type="button" onClick={() => setSourceType('payment')} className={`min-h-10 rounded-md px-3 text-xs font-semibold transition-colors ${sourceType === 'payment' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Payment source</button></div><label className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/[0.03] px-5 text-center transition-colors hover:bg-primary/[0.06] focus-within:ring-2 focus-within:ring-primary"><CloudUpload className="h-9 w-9 text-primary" /><span className="mt-3 text-sm font-semibold">Drop synthetic files here</span><span className="mt-1 text-xs text-muted-foreground">CSV, XLSX, or PDF · up to 25 MB each</span><span className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-primary/90">Choose files</span><input type="file" multiple accept=".csv,.xlsx,.xls,.pdf" className="sr-only" onChange={handleFiles} disabled={uploading} /></label><div className="flex flex-wrap gap-2"><StatusBadge label={`${fileQueue.filter(item => item.source === 'invoice' && item.status !== 'error').length} invoice files valid`} tone="green" icon={<Check className="h-3 w-3" />} /><StatusBadge label={`${fileQueue.filter(item => item.source === 'payment' && item.status !== 'error').length} payment files valid`} tone="green" icon={<Check className="h-3 w-3" />} /></div></CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><div><CardTitle className="text-sm">Session file queue</CardTitle><CardDescription className="text-xs">Assign each file to an extraction source before running.</CardDescription></div><Button type="button" onClick={runReconciliation} disabled={processing || uploading} className="rounded-lg">{processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing</> : <><Play className="mr-2 h-4 w-4" />Run reconciliation</>}</Button></CardHeader><CardContent className="space-y-3">{fileQueue.length === 0 ? <EmptyState title="No uploaded files" description="Load the synthetic sample pack for an immediate demonstration, or choose CSV, XLSX, and PDF files above." actionLabel="Use sample pack" onAction={loadSamplePack} icon={<CloudUpload className="h-5 w-5" />} /> : fileQueue.map((item, index) => <div key={`${item.file.name}-${index}`} className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary"><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{item.file.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.source === 'invoice' ? 'Invoice source' : 'Payment source'} · {(item.file.size / 1024).toFixed(0)} KB</p>{item.message && <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">{item.message}</p>}</div><select aria-label={`Source type for ${item.file.name}`} value={item.source} onChange={event => setFileQueue(previous => previous.map((current, currentIndex) => currentIndex === index ? { ...current, source: event.target.value as 'invoice' | 'payment' } : current))} className="min-h-10 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"><option value="invoice">Invoice source</option><option value="payment">Payment source</option></select><StatusBadge label={item.status === 'uploading' ? 'Uploading' : item.status === 'uploaded' ? 'Uploaded' : item.status === 'error' ? 'Blocked' : 'Ready'} tone={item.status === 'error' ? 'red' : item.status === 'ready' ? 'blue' : 'green'} icon={item.status === 'uploading' ? <Loader2 className="h-3 w-3 animate-spin" /> : item.status === 'error' ? <XCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />} /><ButtonIcon label={`Remove ${item.file.name}`} onClick={() => setFileQueue(previous => previous.filter((_, currentIndex) => currentIndex !== index))}><Trash2 className="h-4 w-4" /></ButtonIcon></div>)}</CardContent></Card></div><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm">Current policy before run</CardTitle><CardDescription className="text-xs">Settings are session-only. Change them in Settings before sending uploaded assets to the manager.</CardDescription></CardHeader><CardContent><PolicyStrip rules={rules} /></CardContent></Card></div>

  const renderReconciliation = () => {
    if (!data) return <EmptyState title="Reconciliation results are empty" description="Load the synthetic sample pack or upload source files, then run the manager to populate match evidence." actionLabel="Open file upload" onAction={() => navigate('upload')} icon={<Table2 className="h-5 w-5" />} />
    const selectedDetail = selectedMatch ? SYNTHETIC_DETAILS[selectedMatch.invoice_number] : null
    return <div className="space-y-6"><PageHeader eyebrow="03 / Matching" title="Reconciliation Centre" description={`Run ${data.run_id} · ${summary?.invoice_count ?? 0} synthetic invoices and ${summary?.payment_count ?? 0} synthetic payments processed.`} actions={<><Button type="button" variant="outline" onClick={exportResults} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Export simulated CSV</Button><Button type="button" variant="outline" onClick={() => navigate('settings')} className="rounded-lg"><Settings2 className="mr-2 h-4 w-4" />Review rules</Button><Button type="button" onClick={() => navigate('upload')} className="rounded-lg"><RefreshCw className="mr-2 h-4 w-4" />New run</Button></>} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Reconciliation rate" value={formatPercent(summary?.reconciliation_rate ?? 0)} detail="Current synthetic run" icon={<CheckCircle2 className="h-4 w-4" />} /><MetricCard label="Exact matches" value={String(counts.exact_match)} detail="All key fields agree" icon={<Check className="h-4 w-4" />} /><MetricCard label="Tolerance matches" value={String(counts.tolerance_match)} detail="Within configured policy" icon={<SlidersHorizontal className="h-4 w-4" />} /><MetricCard label="Suggested matches" value={String(counts.suggested_match)} detail="Human review required" tone="warning" icon={<Sparkles className="h-4 w-4" />} /><MetricCard label="Open exceptions" value={String(counts.exception)} detail="Investigate or route" tone="danger" icon={<CircleAlert className="h-4 w-4" />} /></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><Card className="min-w-0 overflow-hidden rounded-xl border-border/70 shadow-sm"><div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between"><div className="relative min-w-0 flex-1 lg:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={resultSearch} onChange={event => setResultSearch(event.target.value)} placeholder="Search invoice, payment, or currency" className="h-10 rounded-lg pl-9 text-xs" /></div><div className="flex flex-wrap gap-1.5">{([{ key: 'all', label: 'All', count: counts.all }, { key: 'exact_match', label: 'Exact', count: counts.exact_match }, { key: 'tolerance_match', label: 'Tolerance', count: counts.tolerance_match }, { key: 'suggested_match', label: 'Suggested', count: counts.suggested_match }, { key: 'exception', label: 'Exceptions', count: counts.exception }] as Array<{ key: 'all' | Classification; label: string; count: number }>).map(filter => <button type="button" key={filter.key} onClick={() => setResultFilter(filter.key)} className={`min-h-10 rounded-lg border px-3 text-[11px] font-semibold transition-colors ${resultFilter === filter.key ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{filter.label} <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px]">{filter.count}</span></button>)}</div></div><PolicyStrip rules={activeRules} /><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left"><thead className="bg-muted/40"><tr className="border-b border-border/70 text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3 font-semibold">Invoice / payment</th><th className="px-3 py-3 font-semibold">Currency</th><th className="px-3 py-3 font-semibold">Match status</th><th className="px-3 py-3 font-semibold">Amount variance</th><th className="px-3 py-3 font-semibold">Confidence</th><th className="px-3 py-3 font-semibold">Flags</th><th className="px-4 py-3" /></tr></thead><tbody>{filteredMatches.map(match => <tr key={match.match_id} className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${selectedMatch?.match_id === match.match_id ? 'bg-primary/[0.06]' : ''}`}><td className="px-4 py-3"><button type="button" onClick={() => setSelectedMatchId(match.match_id)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><span className="block text-xs font-semibold text-foreground">{match.invoice_number}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{match.payment_reference}</span></button></td><td className="px-3 py-3 text-xs font-semibold tabular-nums">{match.currency}</td><td className="px-3 py-3"><StatusBadge label={titleForClassification(match.classification)} tone={statusTone(match.classification)} icon={match.classification === 'exact_match' ? <Check className="h-3 w-3" /> : match.classification === 'exception' ? <XCircle className="h-3 w-3" /> : <Info className="h-3 w-3" />} /></td><td className={`px-3 py-3 text-xs tabular-nums ${match.amount_variance > 0 ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-muted-foreground'}`}>{formatCurrency(match.amount_variance, match.currency)}</td><td className="px-3 py-3"><span className="text-xs font-semibold tabular-nums">{match.confidence ? `${match.confidence}%` : '—'}</span><div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${match.confidence >= 95 ? 'bg-emerald-500' : match.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(0, Math.min(100, match.confidence))}%` }} /></div></td><td className="max-w-44 px-3 py-3"><div className="flex flex-wrap gap-1">{(Array.isArray(match.risk_flags) ? match.risk_flags : []).slice(0, 2).map(flag => <Badge key={flag} variant="outline" className="text-[9px]">{flag.replaceAll('_', ' ')}</Badge>)}</div></td><td className="px-4 py-3 text-right"><ButtonIcon label={`Open evidence for ${match.invoice_number}`} onClick={() => setSelectedMatchId(match.match_id)}><ChevronRight className="h-4 w-4" /></ButtonIcon></td></tr>)}</tbody></table></div><div className="flex flex-col gap-2 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {filteredMatches.length} of {matches.length} synthetic records</span><span className="font-mono uppercase tracking-wide">Assets and source IDs remain session-only</span></div></Card><aside className="min-w-0"><Card className="overflow-hidden rounded-xl border-border/70 shadow-sm"><CardHeader className="border-b border-border/70 pb-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Selected match</p><CardTitle className="mt-2 text-base">{selectedMatch?.invoice_number ?? 'No selected match'} <span className="text-muted-foreground">⇄</span> {selectedMatch?.payment_reference ?? '—'}</CardTitle><CardDescription className="mt-1 text-xs">{selectedMatch ? `${titleForClassification(selectedMatch.classification)} · ${selectedMatch.approval_required ? 'Human approval required' : 'No approval required'}` : 'Select a result row to inspect evidence.'}</CardDescription></div>{selectedMatch && <ButtonIcon label="Clear selected match" onClick={() => setSelectedMatchId('')}><X className="h-4 w-4" /></ButtonIcon>}</div></CardHeader>{selectedMatch ? <><CardContent className="space-y-5 p-4"><div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold">Source comparison</h3><StatusBadge label={`${selectedMatch.confidence}% confidence`} tone={statusTone(selectedMatch.classification)} /></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-lg border border-border/70 bg-muted/20 p-3"><p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Invoice source</p><p className="mt-1 text-xs font-semibold">{selectedMatch.invoice_number}</p><div className="mt-2">{selectedDetail ? <><SourceField label="Vendor" value={selectedDetail.vendor} /><SourceField label="Date" value={selectedDetail.invoiceDate} /><SourceField label="Amount" value={selectedDetail.invoiceAmount} /><SourceField label="Status" value={selectedDetail.invoiceStatus} /></> : <><SourceField label="Currency" value={selectedMatch.currency} /><SourceField label="Source assets" value={selectedMatch.source_asset_ids.join(', ')} /></>}</div></div><div className="rounded-lg border border-border/70 bg-muted/20 p-3"><p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Payment source</p><p className="mt-1 text-xs font-semibold">{selectedMatch.payment_reference}</p><div className="mt-2">{selectedDetail ? <><SourceField label="Payee" value={selectedDetail.vendor} /><SourceField label="Date" value={selectedDetail.paymentDate} /><SourceField label="Amount" value={selectedDetail.paymentAmount} /><SourceField label="Status" value={selectedDetail.paymentStatus} /></> : <><SourceField label="Currency" value={selectedMatch.currency} /><SourceField label="Date variance" value={`${selectedMatch.date_variance_days} days`} /></>}</div></div></div></div><div><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold">Rule evidence</h3><span className="text-[10px] text-muted-foreground">{selectedMatch.rule_evidence.length} evidence items</span></div><div className="space-y-2">{(Array.isArray(selectedMatch.rule_evidence) ? selectedMatch.rule_evidence : []).map(evidence => <div key={evidence} className="flex items-start gap-2 text-[11px]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>{evidence}</span></div>)}{(Array.isArray(selectedMatch.risk_flags) ? selectedMatch.risk_flags : []).map(flag => <div key={flag} className="flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{flag.replaceAll('_', ' ')}</span></div>)}</div></div><div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-xs leading-5"><div className="mb-1 flex items-center justify-between gap-2"><strong>AI recommendation</strong><Badge variant="outline" className="text-[9px]">{metadata.agent_name}</Badge></div><p>{selectedMatch.classification === 'exact_match' ? 'Exact match is supported by the declared rule evidence.' : selectedMatch.classification === 'tolerance_match' ? 'Likely tolerance match; review the variance against the active policy.' : selectedMatch.classification === 'suggested_match' ? 'Likely tolerance match, but route to a human approver because confidence or sensitive-value policy requires review.' : 'Do not auto-reconcile. Investigate the exception and confirm source completeness.'}</p><p className="mt-2 text-[10px] text-muted-foreground">Amount variance {formatCurrency(selectedMatch.amount_variance, selectedMatch.currency)} · Date variance {selectedMatch.date_variance_days} day(s) · Approval {selectedMatch.approval_status.replaceAll('_', ' ')}</p></div><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] leading-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>Simulation safeguard:</strong> routing or approving this case only changes session workflow status. It cannot release funds, modify a balance, or post a ledger.</div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => navigate('approvals')} className="rounded-lg" disabled={!selectedMatch.approval_required}><ShieldCheck className="mr-2 h-4 w-4" />Route to approval</Button><Button type="button" variant="outline" onClick={() => navigate('exceptions')} className="rounded-lg"><CircleAlert className="mr-2 h-4 w-4" />Open exceptions</Button></div></CardContent><div className="border-t border-border/70 bg-muted/20 px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Complete contract fields</p><div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><span>Match ID <strong className="ml-1">{selectedMatch.match_id}</strong></span><span>Currency <strong className="ml-1">{selectedMatch.currency}</strong></span><span>Approval required <strong className="ml-1">{String(selectedMatch.approval_required)}</strong></span><span>Assets <strong className="ml-1">{selectedMatch.source_asset_ids.length}</strong></span></div></div></> : <CardContent><EmptyState title="Select a match" description="Choose a row to review source comparison, rule evidence, risk flags, and the advisory recommendation." /></CardContent>}</Card></aside></div></div>
  }

  const renderInvoiceProcessing = () => {
    if (!data) return <EmptyState title="No extraction results" description="Upload supported synthetic files or load the sample pack to review extracted fields." actionLabel="Open upload" onAction={() => navigate('upload')} icon={<FileCheck2 className="h-5 w-5" />} />
    const extractionRows = matches.slice(0, 12)
    return <div className="space-y-6"><PageHeader eyebrow="04 / Extraction" title="Invoice Processing" description="Review normalized invoice identifiers, source assets, validation signals, and session-only correction notes before matching." actions={<Button type="button" variant="outline" onClick={() => navigate('upload')} className="rounded-lg"><Upload className="mr-2 h-4 w-4" />Add source files</Button>} /><div className="grid gap-4 md:grid-cols-3"><MetricCard label="Invoices extracted" value={String(summary?.invoice_count ?? 0)} detail="Synthetic source records" icon={<FileText className="h-4 w-4" />} /><MetricCard label="Validation flags" value={String(exceptions.length)} detail="Require analyst attention" tone="warning" icon={<AlertCircle className="h-4 w-4" />} /><MetricCard label="Correction mode" value="Session" detail="Changes are not persisted" icon={<RotateCcw className="h-4 w-4" />} /></div><Card className="overflow-hidden rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-col gap-3 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm">Extracted invoice records</CardTitle><CardDescription className="text-xs">Every displayed field comes from the manager contract or session-only correction state.</CardDescription></div><StatusBadge label={data.synthetic_only ? 'Synthetic only' : 'Contract flag requires review'} tone={data.synthetic_only ? 'green' : 'red'} icon={data.synthetic_only ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} /></CardHeader><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left"><thead className="bg-muted/40"><tr className="border-b border-border/70 text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Invoice</th><th className="px-3 py-3">Source assets</th><th className="px-3 py-3">Currency</th><th className="px-3 py-3">Validation</th><th className="px-3 py-3">Correction</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{extractionRows.map(match => { const flags = match.risk_flags.length > 0 ? match.risk_flags : ['no validation flags']; return <tr key={match.match_id} className="border-b border-border/60"><td className="px-4 py-3"><p className="text-xs font-semibold">{match.invoice_number}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{match.match_id}</p></td><td className="max-w-48 px-3 py-3 text-[10px] text-muted-foreground">{match.source_asset_ids.join(' · ')}</td><td className="px-3 py-3 text-xs font-semibold">{match.currency}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1">{flags.map(flag => <StatusBadge key={flag} label={flag.replaceAll('_', ' ')} tone={flag === 'no validation flags' ? 'green' : 'amber'} />)}</div></td><td className="px-3 py-3"><Input aria-label={`Correction for ${match.invoice_number}`} value={corrections[match.invoice_number] ?? ''} onChange={event => setCorrections(previous => ({ ...previous, [match.invoice_number]: event.target.value }))} placeholder="Optional session note" className="h-9 min-w-44 text-xs" /></td><td className="px-4 py-3"><Button type="button" variant="outline" size="sm" onClick={() => { appendAudit(localAudit('FIELD_CORRECTION_NOTED', 'Session user', match.invoice_number, corrections[match.invoice_number] || 'Reviewed extracted invoice record without a correction.')); setSuccessMessage(`${match.invoice_number} review noted in session audit history.`) }} className="rounded-lg text-xs">Save note</Button></td></tr> })}</tbody></table></div></Card></div>
  }

  const renderExceptions = () => {
    if (!data || exceptions.length === 0) return <EmptyState title="No open exceptions" description="There are no exception records in the active result. Upload another synthetic source or rerun with a different policy." actionLabel="Open reconciliation" onAction={() => navigate('reconciliation')} icon={<CheckCircle2 className="h-5 w-5" />} />
    return <div className="space-y-6"><PageHeader eyebrow="05 / Investigation" title="Exception Management" description="Triage missing candidates, duplicates, policy breaches, and low-confidence results before safe simulated routing." actions={<><Button type="button" variant="outline" onClick={exportExceptions} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Export exception CSV</Button><Button type="button" onClick={() => navigate('approvals')} className="rounded-lg"><ShieldCheck className="mr-2 h-4 w-4" />Approval queue</Button></>} /><div className="flex flex-wrap gap-2">{(['all', 'critical', 'high', 'medium', 'low'] as const).map(filter => <button type="button" key={filter} onClick={() => setExceptionFilter(filter)} className={`min-h-10 rounded-lg border px-3 text-xs font-semibold capitalize transition-colors ${exceptionFilter === filter ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}>{filter} {filter === 'all' ? `(${exceptions.length})` : `(${exceptions.filter(item => item.severity === filter).length})`}</button>)}</div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]"><Card className="overflow-hidden rounded-xl border-border/70 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-sm">Triage board</CardTitle><CardDescription className="text-xs">Select an exception to open evidence and add a session-only analyst note.</CardDescription></CardHeader><CardContent className="space-y-2">{filteredExceptions.map(item => <button type="button" key={item.exception_id} onClick={() => setSelectedExceptionId(item.exception_id)} className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted ${selectedException?.exception_id === item.exception_id ? 'border-primary/40 bg-primary/[0.05]' : 'border-border/70 bg-card'}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold">{item.exception_id} · {item.invoice_number}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.reason_code} · {item.payment_reference}</p></div><StatusBadge label={item.severity} tone={statusTone(item.severity)} icon={<AlertCircle className="h-3 w-3" />} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{item.message}</p><div className="mt-3 flex flex-wrap gap-1">{item.risk_flags.map(flag => <Badge key={flag} variant="outline" className="text-[9px]">{flag.replaceAll('_', ' ')}</Badge>)}</div></button>)}</CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="border-b border-border/70 pb-4"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Investigation workspace</p><CardTitle className="mt-2 text-base">{selectedException?.exception_id ?? 'No selection'}</CardTitle></div>{selectedException && <StatusBadge label={selectedException.approval_status.replaceAll('_', ' ')} tone="amber" />}</div></CardHeader>{selectedException ? <CardContent className="space-y-4 p-4"><div className="rounded-lg border border-border/70 bg-muted/20 p-3"><SourceField label="Invoice" value={selectedException.invoice_number} /><SourceField label="Payment" value={selectedException.payment_reference} /><SourceField label="Reason code" value={selectedException.reason_code} /><SourceField label="Severity" value={selectedException.severity} /><SourceField label="Approval required" value={String(selectedException.approval_required)} /><SourceField label="Approval status" value={selectedException.approval_status} /></div><div><p className="mb-2 text-xs font-semibold">Exception message</p><div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:bg-red-950/40 dark:text-red-200">{selectedException.message}</div></div><div><p className="mb-2 text-xs font-semibold">Suggested resolution</p><div className="rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-xs leading-5">{renderMarkdown(selectedException.suggested_resolution)}</div></div><div><Label htmlFor="exception-note" className="text-xs font-semibold">Analyst investigation note</Label><Textarea id="exception-note" value={exceptionNotes[selectedException.exception_id] ?? ''} onChange={event => setExceptionNotes(previous => ({ ...previous, [selectedException.exception_id]: event.target.value }))} placeholder="Record what was checked; this stays in session memory." className="mt-2 min-h-24 text-xs" /></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => { appendAudit(localAudit('HUMAN_NOTE', role, selectedException.exception_id, exceptionNotes[selectedException.exception_id] || 'Analyst reviewed the exception without a note.')); setSuccessMessage('Investigation note recorded in session audit history.') }} className="rounded-lg"><Check className="mr-2 h-4 w-4" />Save investigation</Button><Button type="button" variant="outline" onClick={() => navigate('approvals')} className="rounded-lg"><ShieldCheck className="mr-2 h-4 w-4" />Route safely</Button></div><p className="text-[10px] leading-4 text-muted-foreground">Routing changes only a simulated workflow status. It does not release a payment or modify any financial record.</p></CardContent> : <CardContent><EmptyState title="Select an exception" description="Choose a case from the triage board to investigate it." /></CardContent>}</Card></div></div>
  }

  const renderOperations = () => <div className="space-y-6"><PageHeader eyebrow="06 / Observability" title="AI Agent Operations" description="Monitor the session run, active manager, delegated agent names, captured events, and synthetic report outputs." actions={<><Button type="button" variant="outline" onClick={exportAudit} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Export audit CSV</Button><Button type="button" onClick={runReconciliation} disabled={processing} className="rounded-lg"><RefreshCw className="mr-2 h-4 w-4" />{runState === 'error' ? 'Retry run' : 'Run again'}</Button></>} /><div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><ActivityPanel entries={activityEntries} processing={processing} activeAgent={activeAgent} activeAgentId={activeAgentId} /><div className="space-y-4"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-sm">Run health</CardTitle><CardDescription className="text-xs">{metadata.agent_name} · {metadata.timestamp}</CardDescription></div><StatusBadge label={runState === 'completed' ? 'Completed' : runState === 'processing' ? 'Processing' : runState === 'error' ? 'Failed' : 'Ready'} tone={runState === 'completed' ? 'green' : runState === 'processing' ? 'blue' : runState === 'error' ? 'red' : 'slate'} icon={runState === 'processing' ? <Loader2 className="h-3 w-3 animate-spin" /> : runState === 'error' ? <AlertCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />} /></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-3 gap-2"><div className="rounded-lg border border-border/70 p-3"><p className="font-serif text-xl tabular-nums">{runState === 'completed' ? '42s' : '—'}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Run time</p></div><div className="rounded-lg border border-border/70 p-3"><p className="font-serif text-xl tabular-nums">{data ? '98.2%' : '—'}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Extraction</p></div><div className="rounded-lg border border-border/70 p-3"><p className="font-serif text-xl tabular-nums">{runState === 'error' ? '1' : '0'}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Failures</p></div></div><div><div className="flex items-center justify-between text-xs"><span>Exact + tolerance match</span><strong>{formatPercent(summary?.reconciliation_rate ?? 0)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, summary?.reconciliation_rate ?? 0)}%` }} /></div></div><div><div className="flex items-center justify-between text-xs"><span>Human review routed</span><strong>{summary ? formatPercent(100 - summary.reconciliation_rate) : '—'}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, 100 - (summary?.reconciliation_rate ?? 0)))}%` }} /></div></div></CardContent></Card><AgentRoster activeAgent={activeAgent} processing={processing} /></div></div><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-sm">Synthetic report package</CardTitle><CardDescription className="text-xs">Every download is labeled and generated from current browser-memory state.</CardDescription></div><StatusBadge label="4 outputs" tone="blue" /></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{[{ title: 'Reconciliation results', detail: `${matches.length} rows · CSV`, action: exportResults, icon: <Table2 className="h-4 w-4" /> }, { title: 'Exception register', detail: `${exceptions.length} rows · CSV`, action: exportExceptions, icon: <CircleAlert className="h-4 w-4" /> }, { title: 'Approval decision log', detail: `${approvalQueue.length} rows · CSV`, action: exportApprovals, icon: <ShieldCheck className="h-4 w-4" /> }, { title: 'Executive summary', detail: 'Print-ready browser report', action: () => window.print(), icon: <BarChart3 className="h-4 w-4" /> }].map(report => <div key={report.title} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary">{report.icon}</div><div className="min-w-0"><p className="truncate text-xs font-semibold">{report.title}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">SIMULATED · SYNTHETIC · {report.detail}</p></div></div><Button type="button" variant="outline" size="sm" onClick={report.action} className="shrink-0 rounded-lg text-xs"><Download className="mr-1.5 h-3.5 w-3.5" />{report.title === 'Executive summary' ? 'Open' : 'Download'}</Button></div>)}</CardContent></Card></div>

  const renderApprovals = () => <div className="space-y-6"><PageHeader eyebrow="07 / Human review" title="Approval Centre" description={`Simulated ${role} view. Decisions require a note and update only the current session’s workflow state.`} actions={<><div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3"><UserRound className="h-4 w-4 text-muted-foreground" /><select aria-label="Approval role" value={role} onChange={event => setRole(event.target.value as Role)} className="min-h-10 bg-transparent text-xs font-semibold outline-none"><option>Analyst</option><option>Approver</option><option>Auditor</option></select></div><Button type="button" variant="outline" onClick={exportApprovals} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Export decision log</Button></>} /><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Simulation-only approval:</strong> Approve, reject, and return actions cannot release funds, change balances, or post to a ledger. This role selector is not authentication.</p></div></div>{approvalQueue.length === 0 ? <EmptyState title="Approval queue is empty" description="No sensitive or uncertain cases are awaiting a simulated human decision." actionLabel="Open reconciliation" onAction={() => navigate('reconciliation')} icon={<CheckCircle2 className="h-5 w-5" />} /> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Cases awaiting human review</CardTitle><CardDescription className="text-xs">Required role, risk level, and note requirements come from the manager contract.</CardDescription></CardHeader><CardContent className="space-y-2">{approvalQueue.map(item => { const recorded = decisions[item.case_id]; return <button type="button" key={item.case_id} onClick={() => setSelectedApprovalId(item.case_id)} className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted ${selectedApproval?.case_id === item.case_id ? 'border-primary/40 bg-primary/[0.05]' : 'border-border/70 bg-card'}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold">{item.case_id}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.case_type} · required role: {item.required_role}</p></div><StatusBadge label={recorded?.status?.replaceAll('_', ' ') ?? item.risk_level} tone={recorded ? statusTone(recorded.status) : statusTone(item.risk_level === 'critical' ? 'critical' : item.risk_level === 'high' ? 'high' : 'medium')} /></div><p className="mt-2 text-xs text-muted-foreground">{item.reason}</p><p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">Decision note required: {String(item.decision_note_required)}</p></button> })}</CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader className="border-b border-border/70"><p className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Sensitive case summary</p><CardTitle className="mt-2 text-base">{selectedApproval?.case_id ?? 'No selected case'}</CardTitle><CardDescription className="text-xs">Side-by-side evidence is available in Reconciliation Centre.</CardDescription></CardHeader>{selectedApproval ? <CardContent className="space-y-4 p-4"><div className="rounded-lg border border-border/70 bg-muted/20 p-3"><SourceField label="Case type" value={selectedApproval.case_type} /><SourceField label="Reason" value={selectedApproval.reason} /><SourceField label="Risk level" value={selectedApproval.risk_level} /><SourceField label="Required role" value={selectedApproval.required_role} /><SourceField label="Note required" value={String(selectedApproval.decision_note_required)} /><SourceField label="Current decision" value={decisions[selectedApproval.case_id]?.status?.replaceAll('_', ' ') ?? 'awaiting human approval'} /></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => openApprovalDialog(selectedApproval.case_id, 'approve')} disabled={role !== 'Approver' || Boolean(decisions[selectedApproval.case_id])} className="rounded-lg"><Check className="mr-2 h-4 w-4" />Approve simulated</Button><Button type="button" variant="outline" onClick={() => openApprovalDialog(selectedApproval.case_id, 'return')} disabled={role !== 'Approver' || Boolean(decisions[selectedApproval.case_id])} className="rounded-lg">Return to analyst</Button><Button type="button" variant="destructive" onClick={() => openApprovalDialog(selectedApproval.case_id, 'reject')} disabled={role !== 'Approver' || Boolean(decisions[selectedApproval.case_id])} className="rounded-lg"><XCircle className="mr-2 h-4 w-4" />Reject match</Button></div>{role !== 'Approver' && <p className="text-[11px] text-muted-foreground">Switch to the simulated Approver role to enable decision controls. Analysts investigate; Auditors are read-only.</p>}<Button type="button" variant="ghost" onClick={() => navigate('reconciliation')} className="px-0 text-xs text-primary hover:bg-transparent hover:text-primary/80">Open source comparison <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></CardContent> : <CardContent><EmptyState title="Select a case" description="Choose an approval queue row to review its contract fields." /></CardContent>}</Card></div>}</div>

  const renderReports = () => {
    if (!data || !summary) return <EmptyState title="No report data" description="Load synthetic data or complete a manager run before generating reports." actionLabel="Open dashboard" onAction={() => navigate('dashboard')} icon={<BarChart3 className="h-5 w-5" />} />
    const taxonomy = exceptions.reduce<Record<string, number>>((acc, item) => { acc[item.reason_code] = (acc[item.reason_code] ?? 0) + 1; return acc }, {})
    return <div className="space-y-6"><PageHeader eyebrow="08 / Governance" title="Reports & Analytics" description="Explore synthetic reconciliation trends, risk taxonomy, currency summaries, and clearly labeled session exports." actions={<><Button type="button" variant="outline" onClick={exportResults} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Results CSV</Button><Button type="button" onClick={() => window.print()} className="rounded-lg"><BarChart3 className="mr-2 h-4 w-4" />Print executive summary</Button></>} /><div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Reconciliation trend</CardTitle><CardDescription className="text-xs">Synthetic seven-run view; no historical persistence is implied.</CardDescription></CardHeader><CardContent><div className="flex h-56 items-end gap-2 border-b border-border/70 px-2">{[71, 76, 78, 84, 87, 90, summary.reconciliation_rate].map((value, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><div className="w-full max-w-12 rounded-t-md bg-primary transition-opacity hover:opacity-80" style={{ height: `${Math.max(12, Math.min(100, value))}%` }} /><span className="font-mono text-[9px] text-muted-foreground">R-{112 + index}</span></div>)}</div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-muted-foreground">Current rate</span><strong className="font-serif text-2xl tabular-nums">{formatPercent(summary.reconciliation_rate)}</strong></div></CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Exception taxonomy</CardTitle><CardDescription className="text-xs">Contract exception reason codes in the active result.</CardDescription></CardHeader><CardContent className="space-y-4">{Object.keys(taxonomy).length === 0 ? <p className="text-xs text-muted-foreground">No exception categories in this session.</p> : Object.entries(taxonomy).map(([key, value]) => <div key={key}><div className="flex items-center justify-between text-xs"><span>{key.replaceAll('_', ' ')}</span><strong className="font-mono tabular-nums">{value}</strong></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(12, (value / Math.max(1, exceptions.length)) * 100)}%` }} /></div></div>)}</CardContent></Card></div><div className="grid gap-4 md:grid-cols-2"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Currency breakdown</CardTitle><CardDescription className="text-xs">Matched value as returned by the manager.</CardDescription></CardHeader><CardContent className="space-y-3">{Array.isArray(summary.currency_breakdown) && summary.currency_breakdown.map(item => <div key={item.currency} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 font-mono text-xs text-primary">{item.currency}</span><span className="text-xs font-semibold">{item.currency} matched value</span></div><span className="font-mono text-xs tabular-nums">{formatCurrency(item.value, item.currency)}</span></div>)}</CardContent></Card><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Export package</CardTitle><CardDescription className="text-xs">SIMULATED / SYNTHETIC DATA ONLY in every output.</CardDescription></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{[{ label: 'Results', fn: exportResults }, { label: 'Exceptions', fn: exportExceptions }, { label: 'Approvals', fn: exportApprovals }, { label: 'Audit history', fn: exportAudit }].map(item => <Button key={item.label} type="button" variant="outline" onClick={item.fn} className="justify-start rounded-lg text-xs"><Download className="mr-2 h-4 w-4" />{item.label} CSV</Button>)}</CardContent></Card></div></div>
  }

  const renderAudit = () => <div className="space-y-6"><PageHeader eyebrow="09 / Auditability" title="Audit History" description="Read-only chronological events for this browser session. The timeline includes uploads, rules, agent runs, recommendations, notes, decisions, exports, and resets." actions={<Button type="button" variant="outline" onClick={exportAudit} className="rounded-lg"><Download className="mr-2 h-4 w-4" />Export audit CSV</Button>} /><Card className="overflow-hidden rounded-xl border-border/70 shadow-sm"><CardHeader className="flex flex-row items-center justify-between border-b border-border/70"><div><CardTitle className="text-sm">Session event timeline</CardTitle><CardDescription className="text-xs">Session ID: {sessionId || 'AR-2418 · synthetic demonstration'}</CardDescription></div><StatusBadge label="Read-only" tone="slate" icon={<ClipboardList className="h-3 w-3" />} /></CardHeader>{auditEvents.length === 0 ? <CardContent><EmptyState title="No audit events" description="Actions performed in this session will appear here." /></CardContent> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-muted/40"><tr className="border-b border-border/70 text-[10px] uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Time</th><th className="px-3 py-3">Event</th><th className="px-3 py-3">Actor</th><th className="px-3 py-3">Entity</th><th className="px-3 py-3">Details</th><th className="px-4 py-3">Origin</th></tr></thead><tbody>{auditEvents.slice().reverse().map((event, index) => <tr key={`${event.at}-${event.event_type}-${index}`} className="border-b border-border/60"><td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] text-muted-foreground">{event.at}</td><td className="px-3 py-3"><Badge variant="outline" className="text-[9px]">{event.event_type.replaceAll('_', ' ')}</Badge></td><td className="px-3 py-3 text-xs font-semibold">{event.actor}</td><td className="px-3 py-3 font-mono text-[10px] text-muted-foreground">{event.entity_id}</td><td className="max-w-xl px-3 py-3 text-xs leading-5 text-muted-foreground">{event.details}</td><td className="px-4 py-3"><StatusBadge label={event.origin} tone={event.origin === 'captured' ? 'blue' : 'slate'} /></td></tr>)}</tbody></table></div>}</Card></div>

  const renderSettings = () => <div className="space-y-6"><PageHeader eyebrow="10 / Configuration" title="Settings" description="Tune the reconciliation policy for this browser session. Saving settings stamps the audit timeline; it does not persist beyond refresh or reset." actions={<Button type="button" variant="outline" onClick={() => { setDraftRules(DEFAULT_RULES); setRules(DEFAULT_RULES); appendAudit(localAudit('RULES_RESTORED', 'Session user', 'SESSION_POLICY', 'Default synthetic tolerance and risk rules restored.')); setSuccessMessage('Default session rules restored.') }} className="rounded-lg"><RotateCcw className="mr-2 h-4 w-4" />Restore defaults</Button>} /><form onSubmit={saveRules} className="grid gap-4 xl:grid-cols-[1fr_360px]"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Matching and risk controls</CardTitle><CardDescription className="text-xs">These values are sent with the next manager run and displayed in policy evidence.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="amount-percent" className="text-xs">Amount tolerance (%)</Label><Input id="amount-percent" type="number" min="0" step="0.01" value={draftRules.amount_tolerance_percent} onChange={event => setDraftRules(previous => ({ ...previous, amount_tolerance_percent: Number(event.target.value) }))} className="mt-2" /><p className="mt-1 text-[10px] text-muted-foreground">Default 0.50%.</p></div><div><Label htmlFor="amount-cap" className="text-xs">Amount tolerance cap</Label><Input id="amount-cap" type="number" min="0" step="0.01" value={draftRules.amount_tolerance_cap} onChange={event => setDraftRules(previous => ({ ...previous, amount_tolerance_cap: Number(event.target.value) }))} className="mt-2" /><p className="mt-1 text-[10px] text-muted-foreground">Synthetic equivalent per transaction currency.</p></div><div><Label htmlFor="date-days" className="text-xs">Date tolerance (days)</Label><Input id="date-days" type="number" min="0" step="1" value={draftRules.date_tolerance_days} onChange={event => setDraftRules(previous => ({ ...previous, date_tolerance_days: Number(event.target.value) }))} className="mt-2" /><p className="mt-1 text-[10px] text-muted-foreground">Default ±3 calendar days.</p></div><div><Label htmlFor="auto-confidence" className="text-xs">Auto-match confidence (%)</Label><Input id="auto-confidence" type="number" min="0" max="100" step="1" value={draftRules.auto_match_confidence} onChange={event => setDraftRules(previous => ({ ...previous, auto_match_confidence: Number(event.target.value) }))} className="mt-2" /></div><div><Label htmlFor="human-confidence" className="text-xs">Human-review minimum (%)</Label><Input id="human-confidence" type="number" min="0" max="100" step="1" value={draftRules.human_review_confidence_min} onChange={event => setDraftRules(previous => ({ ...previous, human_review_confidence_min: Number(event.target.value) }))} className="mt-2" /></div><div><Label htmlFor="sensitive-threshold" className="text-xs">Sensitive-value threshold</Label><Input id="sensitive-threshold" type="number" min="0" step="100" value={draftRules.sensitive_value_threshold} onChange={event => setDraftRules(previous => ({ ...previous, sensitive_value_threshold: Number(event.target.value) }))} className="mt-2" /><p className="mt-1 text-[10px] text-muted-foreground">Cases above this value require simulated human review.</p></div><div className="sm:col-span-2"><Label htmlFor="duplicate-rule" className="text-xs">Duplicate detection rule</Label><Input id="duplicate-rule" value={draftRules.duplicate_detection} onChange={event => setDraftRules(previous => ({ ...previous, duplicate_detection: event.target.value }))} className="mt-2" /></div><div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 sm:col-span-2"><StatusBadge label="Currency policy: same currency only" tone="blue" /><p className="text-[11px] text-muted-foreground">Currency policy is fixed by the response contract and cannot be relaxed for automatic matching.</p></div><Button type="submit" className="w-fit rounded-lg sm:col-span-2"><Check className="mr-2 h-4 w-4" />Save session policy</Button></CardContent></Card><div className="space-y-4"><Card className="rounded-xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-sm">Active policy preview</CardTitle><CardDescription className="text-xs">The policy strip is reused across matching views.</CardDescription></CardHeader><CardContent><PolicyStrip rules={rules} /></CardContent></Card><Card className="rounded-xl border-red-200 bg-red-50 shadow-sm dark:border-red-900 dark:bg-red-950/30"><CardHeader><CardTitle className="flex items-center gap-2 text-sm text-red-900 dark:text-red-200"><ShieldCheck className="h-4 w-4" />Hard safety boundary</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-5 text-red-800 dark:text-red-200"><p>There is no payment release action, balance mutation, ledger posting, bank connection, authentication, or durable persistence.</p><p>Approvals only update a simulated workflow status in this browser session.</p></CardContent></Card></div></form></div>

  const renderView = () => { if (activeView === 'dashboard') return renderDashboard(); if (activeView === 'upload') return renderUpload(); if (activeView === 'reconciliation') return renderReconciliation(); if (activeView === 'invoice') return renderInvoiceProcessing(); if (activeView === 'exceptions') return renderExceptions(); if (activeView === 'operations') return renderOperations(); if (activeView === 'approvals') return renderApprovals(); if (activeView === 'reports') return renderReports(); if (activeView === 'audit') return renderAudit(); return renderSettings() }

  return <div className="min-h-screen bg-muted/30 font-sans text-foreground antialiased"><div className="flex min-h-screen"><aside className={`${railCollapsed ? 'lg:w-[76px]' : 'lg:w-60'} fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/10 bg-[#081b3a] text-slate-200 transition-[width] duration-200 lg:flex`}><div className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">AR</div>{!railCollapsed && <div className="min-w-0"><p className="truncate text-xs font-bold text-white">Autonomous Recon</p><p className="mt-0.5 truncate text-[10px] text-slate-400">Banking Operations</p></div>}</div><nav className="flex-1 overflow-y-auto px-3 pb-4">{NAV_GROUPS.map(group => <div key={group.label}><p className={`${railCollapsed ? 'sr-only' : ''} mb-2 mt-6 px-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500`}>{group.label}</p>{group.items.map(item => { const Icon = item.icon; return <button type="button" key={item.key} onClick={() => navigate(item.key)} title={railCollapsed ? item.label : undefined} className={`group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium transition-colors ${activeView === item.key ? 'bg-blue-700/50 text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'} ${railCollapsed ? 'justify-center px-2' : ''}`}><Icon className="h-4 w-4 shrink-0" />{!railCollapsed && <><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.count && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{item.count}</span>}</>}</button> })}</div>)}</nav><div className={`${railCollapsed ? 'px-2' : 'px-3'} pb-3`}><div className="rounded-lg border border-white/10 bg-white/5 p-3">{railCollapsed ? <div className="grid place-items-center"><span className="h-2 w-2 rounded-full bg-emerald-400" /></div> : <><p className="font-mono text-[9px] uppercase tracking-wide text-slate-500">Current workspace</p><p className="mt-1 text-xs font-semibold text-white">{sessionId || 'AR-2418'}</p><p className="mt-2 flex items-center gap-2 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Synthetic data active</p></>}</div></div><ButtonIcon label={railCollapsed ? 'Expand navigation rail' : 'Collapse navigation rail'} onClick={() => setRailCollapsed(previous => !previous)}><PanelLeftClose className={`h-4 w-4 text-slate-400 ${railCollapsed ? 'rotate-180' : ''}`} /></ButtonIcon></aside>{mobileNavOpen && <div className="fixed inset-0 z-50 bg-slate-950/50 lg:hidden" onClick={() => setMobileNavOpen(false)}><aside className="flex h-full w-72 flex-col bg-[#081b3a] text-slate-200 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-xs font-black text-white">AR</div><div><p className="text-xs font-bold text-white">Autonomous Recon</p><p className="text-[10px] text-slate-400">Banking Operations</p></div></div><ButtonIcon label="Close navigation" onClick={() => setMobileNavOpen(false)}><X className="h-5 w-5 text-slate-300" /></ButtonIcon></div><nav className="flex-1 overflow-y-auto px-3 pb-4">{NAV_GROUPS.map(group => <div key={group.label}><p className="mb-2 mt-6 px-2 font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">{group.label}</p>{group.items.map(item => { const Icon = item.icon; return <button type="button" key={item.key} onClick={() => navigate(item.key)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-xs font-medium ${activeView === item.key ? 'bg-blue-700/50 text-white' : 'text-slate-300 hover:bg-white/10'}`}><Icon className="h-4 w-4" /><span className="flex-1">{item.label}</span>{item.count && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">{item.count}</span>}</button> })}</div>)}</nav></aside></div>}<main className={`${railCollapsed ? 'lg:pl-[76px]' : 'lg:pl-60'} min-w-0 flex-1 transition-[padding] duration-200`}><header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><ButtonIcon label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu className="h-5 w-5 lg:hidden" /></ButtonIcon><div className="min-w-0"><p className="truncate text-[11px] text-muted-foreground">Operations <span className="mx-1">/</span> <span className="font-semibold text-foreground">{VIEW_LABELS[activeView]}</span></p><p className="mt-1 hidden truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:block">Session-only synthetic workspace</p></div></div><div className="flex items-center gap-1.5 sm:gap-2"><div className="relative hidden md:block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Search cases or references" className="h-10 w-52 rounded-lg pl-9 text-xs xl:w-64" /></div><div className="hidden items-center rounded-lg border border-border bg-card px-2 sm:flex"><UserRound className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><select aria-label="Simulated role" value={role} onChange={event => setRole(event.target.value as Role)} className="min-h-9 bg-transparent text-[11px] font-semibold outline-none"><option>Analyst</option><option>Approver</option><option>Auditor</option></select></div><ButtonIcon label={darkMode ? 'Use light theme' : 'Use dark theme'} onClick={() => setDarkMode(previous => !previous)}>{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</ButtonIcon><ButtonIcon label="Open approval notifications" onClick={() => navigate('approvals')}><Bell className="h-4 w-4" /></ButtonIcon><Button type="button" variant="outline" size="sm" onClick={() => setResetDialog(true)} className="hidden rounded-lg text-xs sm:inline-flex"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset</Button></div></header><div className="flex min-h-10 flex-wrap items-center justify-between gap-2 bg-[#0c2a55] px-4 py-2 text-[10px] font-semibold tracking-wide text-blue-100 sm:px-6 lg:px-8"><span>SIMULATION — SYNTHETIC DATA ONLY · NO PAYMENTS, BALANCES, OR LEDGERS ARE CONNECTED</span><span className="font-normal tracking-normal text-blue-200/80">Refresh clears this workspace · Active role: {role} (simulated)</span></div><div className="border-b border-border/70 bg-background px-4 py-3 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 text-xs font-semibold"><Switch checked={sampleData} onCheckedChange={checked => { setSampleData(checked); if (checked) { setSuccessMessage(agentData ? 'Sample Data is on, but uploaded manager results remain visible.' : 'Sample data is on. Synthetic examples are visible.') } else { setSuccessMessage(agentData ? 'Sample Data is off. Uploaded manager data remains visible.' : 'Sample Data is off. Add synthetic files or load the sample pack to continue.') } }} />Sample Data <span className="font-normal text-muted-foreground">{sampleData ? 'ON · examples visible' : 'OFF · waiting for session input'}</span></label><Button type="button" variant="ghost" size="sm" onClick={() => setResetDialog(true)} className="min-h-9 rounded-lg text-xs sm:hidden"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset workspace</Button></div></div><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 xl:py-8">{error && activeView !== 'upload' && <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Manager run needs attention</p><p className="mt-1 text-xs">{error}</p></div><ButtonIcon label="Dismiss error" onClick={() => setError('')}><X className="h-4 w-4" /></ButtonIcon></div>}{successMessage && activeView !== 'upload' && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><CheckCircle2 className="h-4 w-4" />{successMessage}</div>}{renderView()}</div></main></div><Dialog open={Boolean(decisionDialog)} onOpenChange={open => { if (!open) { setDecisionDialog(null); setDecisionNote('') } }}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-lg"><DialogHeader><DialogTitle>Confirm simulated {decisionDialog?.action}</DialogTitle><DialogDescription>This action changes only the current browser session. It cannot release funds, alter balances, post to a ledger, or contact a bank.</DialogDescription></DialogHeader><div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><strong>Guarded decision:</strong> the final status will be attributed to the simulated Approver role and added to the in-memory audit history.</div><div><Label htmlFor="decision-note" className="text-xs font-semibold">Decision note (required)</Label><Textarea id="decision-note" value={decisionNote} onChange={event => setDecisionNote(event.target.value)} placeholder="Explain the evidence and rationale for this simulated decision." className="mt-2 min-h-28 text-xs" /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => { setDecisionDialog(null); setDecisionNote('') }} className="rounded-lg">Cancel</Button><Button type="button" onClick={handleDecision} disabled={!decisionNote.trim() || role !== 'Approver'} className="rounded-lg">Confirm simulated {decisionDialog?.action}</Button></DialogFooter></DialogContent></Dialog><Dialog open={resetDialog} onOpenChange={setResetDialog}><DialogContent className="rounded-xl sm:max-w-md"><DialogHeader><DialogTitle>Reset synthetic workspace?</DialogTitle><DialogDescription>This clears uploaded assets, corrections, decisions, rules, manager session ID, and audit history from browser memory, then restores the demonstration pack.</DialogDescription></DialogHeader><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><strong>Nothing financial is affected.</strong> This prototype has no bank, payment, balance, or ledger connectivity.</div><DialogFooter><Button type="button" variant="outline" onClick={() => setResetDialog(false)} className="rounded-lg">Keep workspace</Button><Button type="button" variant="destructive" onClick={resetWorkspace} className="rounded-lg"><RotateCcw className="mr-2 h-4 w-4" />Reset synthetic workspace</Button></DialogFooter></DialogContent></Dialog></div>
}
