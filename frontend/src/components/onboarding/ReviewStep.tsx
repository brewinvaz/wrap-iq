'use client';

import type { ContactData, VehicleData, ProjectData, UploadedFile } from '@/app/onboarding/[token]/page';
import { Button } from '@/components/ui/Button';

interface Props {
  contact: ContactData;
  vehicle: VehicleData;
  project: ProjectData;
  files: UploadedFile[];
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] p-4">
      <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

export function ReviewStep({ contact, vehicle, project, files, submitting, onBack, onSubmit }: Props) {
  return (
    <div>
      <h2 className="mb-1 text-[16px] font-semibold text-[var(--text-primary)]">Review & Submit</h2>
      <p className="mb-5 text-[13px] text-[var(--text-secondary)]">
        Please review your information before submitting.
      </p>

      <div className="space-y-4">
        <Section title="Contact">
          <Field label="Name" value={`${contact.first_name} ${contact.last_name}`} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Company" value={contact.company_name} />
          <Field label="Address" value={contact.address} />
        </Section>

        <Section title="Vehicle">
          <Field label="VIN" value={vehicle.vin} />
          <Field label="Year" value={vehicle.year} />
          <Field label="Make" value={vehicle.make} />
          <Field label="Model" value={vehicle.model} />
          <Field label="Type" value={vehicle.vehicle_type} />
        </Section>

        <Section title="Project">
          <Field label="Job type" value={project.job_type === 'commercial' ? 'Commercial' : 'Personal'} />
          <Field label="Description" value={project.project_description} />
          <Field label="Referral" value={project.referral_source} />
        </Section>

        {files.length > 0 && (
          <Section title={`Files (${files.length})`}>
            {files.map((f) => (
              <div key={f.r2_key} className="flex items-center gap-2 py-1">
                <svg className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="flex-1 truncate text-[13px] text-[var(--text-primary)]">{f.filename}</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {(f.size_bytes / 1024 / 1024).toFixed(1)} MB
                </span>
              </div>
            ))}
          </Section>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          onClick={onBack}
          disabled={submitting}
          variant="secondary"
          size="lg"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          loading={submitting}
          size="lg"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
