import {
  AlertTriangle,
  FileWarning,
  FlaskConical,
  PackageX,
  Recycle,
  ShieldAlert,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type FieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'datetime'
  | 'select'
  | 'number'
  | 'checkbox'

export interface Option {
  value: string
  label: string
}

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  options?: Option[]
  /** For free-text fields: datalist suggestions (user can still type anything). */
  suggestions?: string[]
  required?: boolean
  hint?: string
}

export interface FormSection {
  title: string
  fields: FieldDef[]
}

export interface ColumnDef {
  key: string
  label: string
  kind?: 'text' | 'date' | 'datetime' | 'status' | 'severity' | 'number' | 'bool'
}

export type SectionKey = 'quality' | 'security' | 'environment'

export interface ModuleDef {
  /** URL path, also used as the React Router route. */
  path: string
  /** Backend API prefix. */
  api: string
  /** Attachment entity type on the backend. */
  entityType: string
  title: string
  /** Short label used in the sidebar. */
  navLabel: string
  singular: string
  section: SectionKey
  icon: LucideIcon
  columns: ColumnDef[]
  form: FormSection[]
  defaults: Record<string, unknown>
  hasStatus: boolean
  /** If set, creating a record requires staged attachments when this returns
   * a message (shown to the user as the reason files are mandatory). */
  requireFilesWhen?: (values: Record<string, unknown>) => string | null
}

export const SECTIONS: Record<SectionKey, { label: string; color: string }> = {
  quality: { label: 'Quality', color: 'var(--color-quality)' },
  security: { label: 'Safety', color: 'var(--color-security)' },
  environment: { label: 'Environment', color: 'var(--color-environment)' },
}

/** External tools linked from the sidebar, per section. */
export const EXTERNAL_LINKS: Record<SectionKey, { label: string; href: string }[]> = {
  quality: [{ label: 'Complaints', href: 'https://ecm.cascointernal.com/complaints' }],
  security: [],
  environment: [],
}

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
  on_time: 'On time',
  delayed: 'Delayed',
  concluded: 'Concluded',
}

export const SEVERITY_LABELS: Record<string, string> = {
  minor: 'Minor',
  major: 'Major',
  critical: 'Critical',
  first_aid: 'First aid',
  serious: 'Serious',
  fatal: 'Fatal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const RECORD_STATUS: Option[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'closed', label: 'Closed' },
]

// Statuses used in the near-miss spreadsheet (RC.QUA.0020.019)
const NEAR_MISS_STATUS: Option[] = [
  { value: 'on_time', label: 'On time' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'concluded', label: 'Concluded' },
]

const NC_SEVERITY: Option[] = [
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
  { value: 'critical', label: 'Critical' },
]

const opts = (...values: string[]): Option[] =>
  values.map((v) => ({ value: v, label: v }))

// Production sectors seen in the Internal NC spreadsheet
const SECTORS = [
  'Sales',
  'Desenho',
  'Engenharia',
  'Compras',
  'Planeamento',
  'Carpintaria',
  'Metal',
  'Pintura',
  'PVC',
  'Vinil',
  'Montagem',
  'Montagem Vidro',
  'Transformação de Vidro',
  'Movimentação',
  'Acabamento',
  'Embalamento',
  'Armazém',
  'Produção',
  'Limpeza',
]

// Departments used in the LTI accident sheet
const HSE_DEPARTMENTS = opts(
  'Metal',
  'Painting',
  'Vinyl',
  'Glass Assembly',
  'Glass Transformation',
  'Assembly',
  'VETs Assembly',
  'Petsmart Assembly',
  'Plumbing',
  'Electrics',
  'Joinery',
  'Finishing and Cleaning',
  'Packing',
  'Warehouse',
  'Staff',
  'Other',
)

const NM_LOCATIONS = [
  ...HSE_DEPARTMENTS.slice(0, -1),
  ...opts('RPP', 'External Waste Park', 'Other'),
]

const NM_EVENT_TYPES = opts(
  'Fall',
  'Shock',
  'Break',
  'Cut/Perforation',
  'Fire',
  'Electrical Discharge',
  'Other',
)

const BODY_PARTS = opts(
  'Arm/Shoulder',
  'Hand',
  'Fingers',
  'Head',
  'Lumbar',
  'Leg/Foot',
  'Abdomen',
  'Other',
)

const ACCIDENT_NATURE = opts(
  'Cut',
  'Perforation',
  'Muscular',
  'Hit/Projection',
  'Fall',
  'Burn',
  'Other',
)

// Waste types seen in the waste production spreadsheet
const WASTE_TYPES = [
  'Papel e Cartão',
  'Plástico',
  'Madeira',
  'Vidro Mistura',
  'Vidro Incolor',
  'Lamas de Vidro',
  'Metais não ferrosos (alumínio lacado)',
  'Metais não ferrosos (alumínio bruto)',
  'Metais não ferrosos (limalha)',
  'Metais não ferrosos (fio de cobre)',
  'Metais ferrosos (ferro)',
  'Cobre',
  'RIBs',
  'Resíduos contaminados',
]

const WASTE_OPERATORS = ['Resifluxos', 'Metalvalor']

export const MODULES: ModuleDef[] = [
  {
    path: '/quality/internal-nc',
    api: '/quality/internal-nc',
    entityType: 'internal_nc',
    title: 'Internal Non-Conformities',
    navLabel: 'Internal NCs',
    singular: 'Internal NC',
    section: 'quality',
    icon: FileWarning,
    hasStatus: true,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'date_detected', label: 'Date', kind: 'date' },
      { key: 'sector', label: 'Sector' },
      { key: 'po', label: 'PO' },
      { key: 'description', label: 'Description' },
      { key: 'cost', label: 'Cost (€)', kind: 'number' },
      { key: 'severity', label: 'Severity', kind: 'severity' },
      { key: 'status', label: 'Status', kind: 'status' },
    ],
    defaults: { severity: 'minor', status: 'open' },
    form: [
      {
        title: 'Identification',
        fields: [
          { name: 'date_detected', label: 'Date', type: 'date', required: true },
          { name: 'po', label: 'PO', type: 'text' },
          { name: 'project', label: 'Project', type: 'text' },
          { name: 'sector', label: 'Sector', type: 'text', suggestions: SECTORS },
          { name: 'designer', label: 'Designer', type: 'text' },
          { name: 'severity', label: 'Severity', type: 'select', options: NC_SEVERITY, required: true },
        ],
      },
      {
        title: 'Non-conformity & actions',
        fields: [
          { name: 'description', label: 'Description', type: 'textarea', required: true },
          { name: 'root_cause', label: 'Root cause analysis', type: 'textarea' },
          { name: 'corrective_action', label: 'Corrective action', type: 'textarea' },
          { name: 'preventive_action', label: 'Preventive action', type: 'textarea' },
        ],
      },
      {
        title: 'Costs',
        fields: [
          { name: 'cost', label: 'Cost (€)', type: 'number' },
          { name: 'cost_note', label: 'Cost note', type: 'textarea' },
        ],
      },
      {
        title: 'Follow-up',
        fields: [
          { name: 'communicated_date', label: 'Date communicated to sector', type: 'date' },
          { name: 'implementation_date', label: 'Implementation date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUS, required: true },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
    ],
  },
  {
    path: '/quality/external-nc',
    api: '/quality/external-nc',
    entityType: 'external_nc',
    title: 'External Non-Conformities (Suppliers)',
    navLabel: 'External NCs',
    singular: 'External NC',
    section: 'quality',
    icon: PackageX,
    hasStatus: true,
    requireFilesWhen: (values) =>
      values.has_control_range
        ? '“Has control range” is checked — attach the control range document before creating this NC.'
        : null,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'date_detected', label: 'Date', kind: 'date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'item_designation', label: 'Item' },
      { key: 'description', label: 'NC description' },
      { key: 'severity', label: 'Severity', kind: 'severity' },
      { key: 'status', label: 'Status', kind: 'status' },
    ],
    defaults: { severity: 'minor', status: 'open', has_control_range: false },
    form: [
      {
        title: 'Identification (Quality)',
        fields: [
          { name: 'date_detected', label: 'Date', type: 'date', required: true },
          { name: 'supplier', label: 'Supplier', type: 'text', required: true },
          { name: 'severity', label: 'Severity', type: 'select', options: NC_SEVERITY, required: true },
          { name: 'po', label: 'PO / OF', type: 'text' },
          { name: 'delivery_doc', label: 'Delivery note / invoice', type: 'text' },
          { name: 'item_reference', label: 'Item reference', type: 'text' },
          { name: 'item_designation', label: 'Item designation', type: 'text' },
          { name: 'quantity', label: 'Quantity', type: 'number' },
          { name: 'location', label: 'Location', type: 'text' },
          { name: 'description', label: 'NC description', type: 'textarea', required: true },
          { name: 'has_control_range', label: 'Has control range', type: 'checkbox' },
        ],
      },
      {
        title: 'Supplier follow-up (Purchasing)',
        fields: [
          { name: 'communicated_date', label: 'Date communicated to supplier', type: 'date' },
          { name: 'supplier_response', label: 'Supplier response', type: 'textarea' },
          { name: 'root_cause', label: 'Root cause analysis', type: 'textarea' },
          { name: 'action_to_take', label: 'Action to take', type: 'textarea' },
        ],
      },
      {
        title: 'Closure (Warehouse)',
        fields: [
          { name: 'return_note', label: 'Return note nº', type: 'text' },
          { name: 'closure_responsible', label: 'Closure responsible', type: 'text' },
          { name: 'closure_date', label: 'Closure date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUS, required: true },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
    ],
  },
  {
    path: '/quality/test-reports',
    api: '/quality/test-reports',
    entityType: 'test_report',
    title: 'Test Reports & Product Derogations',
    navLabel: 'Test Reports',
    singular: 'Test Report',
    section: 'quality',
    icon: FlaskConical,
    hasStatus: false,
    columns: [
      { key: 'reference', label: 'Test nr.' },
      { key: 'test_date', label: 'Date', kind: 'date' },
      { key: 'tested_by', label: 'Tested by' },
      { key: 'description', label: 'Test description' },
      { key: 'result', label: 'Result' },
      { key: 'products_affected', label: 'Products affected' },
      { key: 'derogation', label: 'Derogation', kind: 'bool' },
    ],
    defaults: { derogation: false },
    form: [
      {
        title: 'Test',
        fields: [
          { name: 'test_date', label: 'Date', type: 'date', required: true },
          { name: 'tested_by', label: 'Tested by', type: 'text', suggestions: ['Qualidade'] },
          { name: 'products_affected', label: 'Product(s) affected', type: 'text' },
          { name: 'description', label: 'Test description', type: 'textarea', required: true },
          { name: 'result', label: 'Test result', type: 'textarea' },
          { name: 'observations', label: 'Observations', type: 'textarea' },
        ],
      },
      {
        title: 'Product derogation',
        fields: [
          { name: 'derogation', label: 'Product derogation', type: 'checkbox' },
          { name: 'first_derogation_po', label: 'First derogation PO', type: 'textarea' },
          { name: 'last_derogation_po', label: 'Last derogation PO', type: 'textarea' },
        ],
      },
    ],
  },
  {
    path: '/security/accidents',
    api: '/security/accidents',
    entityType: 'accident',
    title: 'Work Accidents',
    navLabel: 'Work Accidents',
    singular: 'Work Accident',
    section: 'security',
    icon: AlertTriangle,
    hasStatus: true,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'occurred_at', label: 'Occurred', kind: 'datetime' },
      { key: 'injured_person', label: 'Injured person' },
      { key: 'department', label: 'Department' },
      { key: 'nature', label: 'Nature' },
      { key: 'days_lost', label: 'Days lost', kind: 'number' },
      { key: 'severity', label: 'Severity', kind: 'severity' },
      { key: 'status', label: 'Status', kind: 'status' },
    ],
    defaults: {
      severity: 'first_aid',
      status: 'open',
      days_lost: 0,
      insurance_notified: false,
      act_notified: false,
    },
    form: [
      {
        title: 'Occurrence',
        fields: [
          { name: 'occurred_at', label: 'Date & time', type: 'datetime', required: true },
          { name: 'injured_person', label: 'Injured person', type: 'text', required: true },
          { name: 'department', label: 'Department', type: 'select', options: HSE_DEPARTMENTS },
          {
            name: 'severity',
            label: 'Severity',
            type: 'select',
            required: true,
            options: [
              { value: 'first_aid', label: 'First aid only' },
              { value: 'minor', label: 'Minor' },
              { value: 'serious', label: 'Serious' },
              { value: 'fatal', label: 'Fatal' },
            ],
          },
        ],
      },
      {
        title: 'Accident detail',
        fields: [
          { name: 'description', label: 'Accident detail', type: 'textarea', required: true },
          { name: 'body_part', label: 'Body part', type: 'select', options: BODY_PARTS },
          { name: 'nature', label: 'Nature', type: 'select', options: ACCIDENT_NATURE },
          { name: 'days_lost', label: 'Days lost', type: 'number' },
          { name: 'hours_lost', label: 'Hours lost', type: 'number' },
          { name: 'inability', label: 'Inability', type: 'text' },
          { name: 'witnesses', label: 'Witnesses', type: 'textarea' },
        ],
      },
      {
        title: 'Reporting',
        fields: [
          { name: 'insurance_notified', label: 'Insurance participated', type: 'checkbox' },
          { name: 'act_notified', label: 'Communicated to ACT', type: 'checkbox' },
        ],
      },
      {
        title: 'Actions & closure',
        fields: [
          { name: 'root_cause', label: 'Root cause analysis', type: 'textarea' },
          { name: 'corrective_action', label: 'Corrective action', type: 'textarea' },
          { name: 'preventive_action', label: 'Preventive action', type: 'textarea' },
          { name: 'closed_date', label: 'Closed date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: RECORD_STATUS, required: true },
        ],
      },
    ],
  },
  {
    path: '/security/near-misses',
    api: '/security/near-misses',
    entityType: 'near_miss',
    title: 'Near Misses',
    navLabel: 'Near Misses',
    singular: 'Near Miss',
    section: 'security',
    icon: ShieldAlert,
    hasStatus: true,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'occurred_date', label: 'Date', kind: 'date' },
      { key: 'event_type', label: 'Event' },
      { key: 'location', label: 'Location' },
      { key: 'description', label: 'Description' },
      { key: 'risk_level', label: 'Risk', kind: 'severity' },
      { key: 'status', label: 'Status', kind: 'status' },
    ],
    defaults: { risk_level: 'low', status: 'on_time' },
    form: [
      {
        title: 'Occurrence',
        fields: [
          { name: 'occurred_date', label: 'Date', type: 'date', required: true },
          { name: 'event_type', label: 'Event type', type: 'select', options: NM_EVENT_TYPES },
          { name: 'location', label: 'Location', type: 'select', options: NM_LOCATIONS },
          {
            name: 'risk_level',
            label: 'Risk level',
            type: 'select',
            required: true,
            options: [
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ],
          },
        ],
      },
      {
        title: 'What happened',
        fields: [
          { name: 'description', label: 'Description', type: 'textarea', required: true },
          { name: 'root_cause', label: 'Root cause analysis', type: 'textarea' },
          { name: 'corrective_action', label: 'Corrective action', type: 'textarea' },
        ],
      },
      {
        title: 'Prevention & follow-up',
        fields: [
          { name: 'preventive_action', label: 'Preventive action', type: 'textarea' },
          { name: 'owner', label: 'Owner', type: 'text' },
          { name: 'preventive_close_date', label: 'Preventive action closing date', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', options: NEAR_MISS_STATUS, required: true },
        ],
      },
    ],
  },
  {
    path: '/environment/waste',
    api: '/environment/waste',
    entityType: 'waste',
    title: 'Waste Production Records',
    navLabel: 'Waste Records',
    singular: 'Waste Record',
    section: 'environment',
    icon: Recycle,
    hasStatus: false,
    columns: [
      { key: 'reference', label: 'Reference' },
      { key: 'collection_date', label: 'Collection date', kind: 'date' },
      { key: 'waste_type', label: 'Waste type' },
      { key: 'ler_code', label: 'LER' },
      { key: 'quantity_kg', label: 'Qty (kg)', kind: 'number' },
      { key: 'egar', label: 'e-GAR' },
      { key: 'operator', label: 'Waste operator' },
      { key: 'invoiced_value', label: 'Value (€)', kind: 'number' },
    ],
    defaults: { hazardous: false },
    form: [
      {
        title: 'Waste identification',
        fields: [
          { name: 'collection_date', label: 'Collection date', type: 'date', required: true },
          { name: 'waste_type', label: 'Waste type', type: 'text', required: true, suggestions: WASTE_TYPES },
          { name: 'ler_code', label: 'LER code', type: 'text', hint: 'e.g. 150101' },
          { name: 'waste_description', label: 'Waste description', type: 'text' },
          { name: 'quantity_kg', label: 'Quantity (kg)', type: 'number', required: true },
          { name: 'hazardous', label: 'Hazardous waste', type: 'checkbox' },
        ],
      },
      {
        title: 'Transport & value',
        fields: [
          { name: 'egar', label: 'e-GAR', type: 'text' },
          { name: 'operator', label: 'Waste operator', type: 'text', suggestions: WASTE_OPERATORS },
          {
            name: 'invoiced_value',
            label: 'Invoiced value (€)',
            type: 'number',
            hint: 'Amount invoiced for the waste, when sold (paper, metals, …)',
          },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
    ],
  },
]

export const moduleByPath = (path: string) =>
  MODULES.find((m) => m.path === path)

export const moduleByEntityType = (entityType: string) =>
  MODULES.find((m) => m.entityType === entityType)

/** field name → form label, per entity type (used by the audit history UI). */
export const FIELD_LABELS: Record<string, Record<string, string>> = Object.fromEntries(
  MODULES.map((m) => [
    m.entityType,
    Object.fromEntries(m.form.flatMap((s) => s.fields.map((f) => [f.name, f.label]))),
  ]),
)

/** Human label for an audited value (status codes, booleans, nulls). */
export function auditValueLabel(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const s = String(value)
  if (field === 'status') return STATUS_LABELS[s] ?? s
  if (field === 'severity' || field === 'risk_level') return SEVERITY_LABELS[s] ?? s
  return s
}
