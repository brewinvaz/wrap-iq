'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import { Button } from '@/components/ui/Button';
import { BasicDetailsTab } from './wizard/BasicDetailsTab';
import JobPricingTab from './wizard/JobPricingTab';
import WrapDetailsTab from './wizard/WrapDetailsTab';
import DesignTab from './wizard/DesignTab';
import ProductionTab from './wizard/ProductionTab';
import { InstallDetailsTab } from './wizard/InstallDetailsTab';
import type {
  BasicDetailsState,
  JobPricingState,
  WrapDetailsState,
  DesignState,
  ProductionState,
  InstallState,
} from './wizard/types';
import {
  INITIAL_BASIC_DETAILS,
  INITIAL_JOB_PRICING,
  INITIAL_WRAP_DETAILS,
  INITIAL_DESIGN,
  INITIAL_PRODUCTION,
  INITIAL_INSTALL,
} from './wizard/types';

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                     */
/* ------------------------------------------------------------------ */

const TABS = [
  {
    label: 'Basic Details',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    label: 'Job & Pricing',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Wrap Details',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0L12 17.25l-5.571-3m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" />
      </svg>
    ),
  },
  {
    label: 'Design',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125V11.25a1.125 1.125 0 01-1.125 1.125H4.125A1.125 1.125 0 013 11.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 13.498l6.402-6.401a3.75 3.75 0 015.304 5.304l-6.401 6.402" />
      </svg>
    ),
  },
  {
    label: 'Production',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Install Details',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface CreateWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */

export default function CreateWorkOrderModal({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkOrderModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [basicDetails, setBasicDetails] = useState<BasicDetailsState>(INITIAL_BASIC_DETAILS);
  const [jobPricing, setJobPricing] = useState<JobPricingState>(INITIAL_JOB_PRICING);
  const [wrapDetails, setWrapDetails] = useState<WrapDetailsState>(INITIAL_WRAP_DETAILS);
  const [design, setDesign] = useState<DesignState>(INITIAL_DESIGN);
  const [production, setProduction] = useState<ProductionState>(INITIAL_PRODUCTION);
  const [install, setInstall] = useState<InstallState>(INITIAL_INSTALL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const modalRef = useModalAccessibility(isOpen, onClose);

  const resetForm = () => {
    setActiveTab(0);
    setBasicDetails(INITIAL_BASIC_DETAILS);
    setJobPricing({ ...INITIAL_JOB_PRICING, dateIn: new Date().toISOString().split('T')[0] });
    setWrapDetails(INITIAL_WRAP_DETAILS);
    setDesign(INITIAL_DESIGN);
    setProduction(INITIAL_PRODUCTION);
    setInstall(INITIAL_INSTALL);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      // Step 1: Create vehicle if we have vehicle info
      let vehicleId: string | null = null;
      if (basicDetails.vin || basicDetails.make || basicDetails.model) {
        const vehicleResp = await api.post<{ id: string }>('/api/vehicles', {
          vin: basicDetails.vin || null,
          year: basicDetails.year ? parseInt(basicDetails.year) : null,
          make: basicDetails.make || null,
          model: basicDetails.model || null,
          paint_color: basicDetails.paintColor || null,
          vehicle_unit_number: basicDetails.unitNumber || null,
          vehicle_type: basicDetails.vehicleType || null,
        });
        vehicleId = vehicleResp.id;
      }

      // Step 2: Build work order payload
      const payload: Record<string, unknown> = {
        job_type: jobPricing.jobType,
        job_value: Math.round((Number(jobPricing.jobValue) || 0) * 100),
        priority: jobPricing.priority,
        date_in: jobPricing.dateIn,
        estimated_completion_date: jobPricing.estimatedCompletionDate || null,
        internal_notes: jobPricing.internalNotes || null,
        client_id: jobPricing.clientId || null,
        vehicle_ids: vehicleId ? [vehicleId] : [],
      };

      // Add wrap details if coverage is set
      if (basicDetails.wrapCoverage) {
        payload.wrap_details = {
          wrap_coverage: basicDetails.wrapCoverage,
          roof_coverage: wrapDetails.roofCoverage,
          door_handles: wrapDetails.doorHandles,
          window_coverage: wrapDetails.windowCoverage,
          bumper_coverage: wrapDetails.bumperCoverage,
          misc_items: wrapDetails.miscItems.length > 0 ? wrapDetails.miscItems : null,
          special_wrap_instructions: wrapDetails.specialInstructions || null,
        };
      }

      // Add design details only if user has added files or extra versions
      const hasDesignWork =
        design.proofingData.versions.some(
          (v) => (v.files && v.files.length > 0) || (v.localFiles && v.localFiles.length > 0) || v.designUrl || v.status !== 'draft'
        ) || design.proofingData.versions.length > 1;
      if (hasDesignWork) {
        payload.design_details = {
          proofing_data: design.proofingData,
        };
      }

      // Add production details if any are set
      if (production.printMedia || production.laminate || production.printerId) {
        payload.production_details = {
          printer_id: production.printerId || null,
          laminator_id: production.laminatorId || null,
          plotter_id: production.plotterId || null,
          print_media_brand_type: production.printMedia || null,
          laminate_brand_type: production.laminate || null,
          window_perf_details: production.windowPerf
            ? { type: production.windowPerf }
            : null,
        };
      }

      // Add install details if location is set
      if (install.installLocation) {
        payload.install_details = {
          install_location: install.installLocation,
          install_difficulty: install.installDifficulty || null,
          install_start_date: install.installStartDate
            ? `${install.installStartDate}T00:00:00Z`
            : null,
          install_end_date: install.installEndDate
            ? `${install.installEndDate}T00:00:00Z`
            : null,
        };
      }

      const woResp = await api.post<{ id: string }>('/api/work-orders', payload);
      const workOrderId = woResp.id;

      // Step 3: Upload vehicle photos
      const photoEntries = Object.entries(basicDetails.vehiclePhotos);
      for (const [photoType, file] of photoEntries) {
        try {
          const { upload_url, r2_key } = await api.post<{ upload_url: string; r2_key: string }>(
            `/api/work-orders/${workOrderId}/photos/upload-url`,
            { filename: file.name, content_type: file.type }
          );
          await fetch(upload_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          await api.post(`/api/work-orders/${workOrderId}/photos`, {
            files: [{ r2_key, filename: file.name, content_type: file.type, size_bytes: file.size }],
          });
        } catch {
          console.error(`Failed to upload ${photoType} photo`);
        }
      }

      // Reset form
      resetForm();
      onCreate();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create work order');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-work-order-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-[var(--surface-card)] shadow-xl"
      >
        {/* ========== Header ========== */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3
            id="create-work-order-title"
            className="text-lg font-semibold text-[var(--text-primary)]"
          >
            Create Work Order
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>

        {/* ========== Tab Bar ========== */}
        <div className="border-b border-[var(--border)] px-6">
          <div className="flex gap-1">
            {TABS.map((tab, index) => {
              const isActive = activeTab === index;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-b-2 border-blue-400 text-blue-400'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========== Error ========== */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ========== Tab Content ========== */}
        <div className="overflow-y-auto px-6 py-5 max-h-[calc(80vh-200px)]">
          {activeTab === 0 && <BasicDetailsTab data={basicDetails} onChange={setBasicDetails} />}
          {activeTab === 1 && <JobPricingTab data={jobPricing} onChange={setJobPricing} />}
          {activeTab === 2 && <WrapDetailsTab data={wrapDetails} onChange={setWrapDetails} wrapCoverage={basicDetails.wrapCoverage} />}
          {activeTab === 3 && <DesignTab data={design} onChange={setDesign} />}
          {activeTab === 4 && <ProductionTab data={production} onChange={setProduction} />}
          {activeTab === 5 && <InstallDetailsTab data={install} onChange={setInstall} />}
        </div>

        {/* ========== Footer ========== */}
        <div className="flex items-center gap-3 border-t border-[var(--border)] px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={isSubmitting}
            className="flex-1"
          >
            Create Work Order
          </Button>
        </div>
      </div>
    </div>
  );
}
