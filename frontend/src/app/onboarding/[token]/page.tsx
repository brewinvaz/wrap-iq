'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ContactStep } from '@/components/onboarding/ContactStep';
import { VehicleStep } from '@/components/onboarding/VehicleStep';
import { FilesStep } from '@/components/onboarding/FilesStep';
import { ReviewStep } from '@/components/onboarding/ReviewStep';
import { SuccessPage } from '@/components/onboarding/SuccessPage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type PageState = 'loading' | 'invalid' | 'form' | 'submitting' | 'success';

export interface ContactData {
  first_name: string;
  last_name: string;
  phone: string;
  company_name: string;
  address: string;
}

export interface VehicleData {
  vin: string;
  year: string;
  make: string;
  model: string;
  vehicle_type: string;
}

export interface ProjectData {
  job_type: string;
  project_description: string;
  referral_source: string;
}

export interface UploadedFile {
  r2_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
}

export interface OnboardingResult {
  work_order_id: string;
  job_number: string;
}

const STEPS = ['Contact', 'Vehicle', 'Files & Details', 'Review'];

export default function OnboardingPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [orgName, setOrgName] = useState('');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  const [contact, setContact] = useState<ContactData>({
    first_name: '',
    last_name: '',
    phone: '',
    company_name: '',
    address: '',
  });

  const [vehicle, setVehicle] = useState<VehicleData>({
    vin: '',
    year: '',
    make: '',
    model: '',
    vehicle_type: '',
  });

  const [project, setProject] = useState<ProjectData>({
    job_type: 'personal',
    project_description: '',
    referral_source: '',
  });

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [result, setResult] = useState<OnboardingResult | null>(null);

  // Validate token on mount
  useEffect(() => {
    const validate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/portal/onboarding/${token}`);
        if (!res.ok) {
          setPageState('invalid');
          return;
        }
        const data = await res.json();
        setOrgName(data.organization_name);
        setPageState('form');
      } catch {
        setPageState('invalid');
      }
    };
    validate();
  }, [token]);

  const handleSubmit = async () => {
    setPageState('submitting');
    setError('');

    try {
      const body = {
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone || undefined,
        company_name: contact.company_name || undefined,
        address: contact.address || undefined,
        vehicle: {
          vin: vehicle.vin || undefined,
          year: vehicle.year ? parseInt(vehicle.year) : undefined,
          make: vehicle.make || undefined,
          model: vehicle.model || undefined,
          vehicle_type: vehicle.vehicle_type || undefined,
        },
        job_type: project.job_type || 'personal',
        project_description: project.project_description || undefined,
        referral_source: project.referral_source || undefined,
        file_keys: files,
      };

      const res = await fetch(`${API_BASE}/api/portal/onboarding/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setError(err?.detail || 'Something went wrong. Please try again.');
        setPageState('form');
        return;
      }

      const data = await res.json();
      setResult({ work_order_id: data.work_order_id, job_number: data.job_number });
      setPageState('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setPageState('form');
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[#e6e6eb] border-t-blue-600" />
          <p className="text-[14px] text-[#60606a]">Loading...</p>
        </div>
      </div>
    );
  }

  // Invalid / expired token
  if (pageState === 'invalid') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-[#e6e6eb] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#18181b]">Link expired or invalid</h2>
          <p className="mt-2 text-[14px] text-[#60606a]">
            This onboarding link has expired or has already been used. Please contact the shop for a new invite.
          </p>
        </div>
      </div>
    );
  }

  // Success
  if (pageState === 'success' && result) {
    return <SuccessPage jobNumber={result.job_number} orgName={orgName} />;
  }

  return (
    <div>
      {/* Org welcome */}
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-[#18181b]">
          Welcome to {orgName}
        </h1>
        <p className="mt-1 text-[14px] text-[#60606a]">
          Complete the form below to get your project started.
        </p>
      </div>

      {/* Progress steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                    i < step
                      ? 'bg-blue-600 text-white'
                      : i === step
                        ? 'border-2 border-blue-600 text-blue-600'
                        : 'border-2 border-[#e6e6eb] text-[#a8a8b4]'
                  }`}
                >
                  {i < step ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium ${
                  i <= step ? 'text-[#18181b]' : 'text-[#a8a8b4]'
                }`}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 mb-5 h-px flex-1 ${
                  i < step ? 'bg-blue-600' : 'bg-[#e6e6eb]'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-[13px] text-red-700">{error}</p>
        </div>
      )}

      {/* Form card */}
      <div className="rounded-xl border border-[#e6e6eb] bg-white p-6 shadow-sm">
        {step === 0 && (
          <ContactStep
            data={contact}
            onChange={setContact}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <VehicleStep
            data={vehicle}
            onChange={setVehicle}
            token={token}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <FilesStep
            data={project}
            onChange={setProject}
            files={files}
            onFilesChange={setFiles}
            token={token}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <ReviewStep
            contact={contact}
            vehicle={vehicle}
            project={project}
            files={files}
            submitting={pageState === 'submitting'}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
