'use client';

import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';

interface NewRenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}

interface ClientItem { id: string; name: string; }
interface ClientListResponse { items: ClientItem[]; total: number; }
interface VehicleItem { id: string; make: string | null; model: string | null; year: number | null; }
interface VehicleListResponse { items: VehicleItem[]; total: number; }
interface WorkOrderItem { id: string; job_number: string; }
interface WorkOrderListResponse { items: WorkOrderItem[]; total: number; }
interface UploadInfo { r2_key: string; upload_url: string; }
interface RenderUploadResponse { uploads: UploadInfo[]; }

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_DESIGN_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function NewRenderModal({ isOpen, onClose, onCreate }: NewRenderModalProps) {
  const [designName, setDesignName] = useState('');
  const [vehicleFile, setVehicleFile] = useState<File | null>(null);
  const [designFile, setDesignFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const modalRef = useModalAccessibility(isOpen, onClose);

  // Fetch dropdown data on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api.get<ClientListResponse>('/api/clients?limit=100').then(d => { if (!cancelled) setClients(d.items); }).catch(() => {});
    api.get<VehicleListResponse>('/api/vehicles?limit=100').then(d => { if (!cancelled) setVehicles(d.items); }).catch(() => {});
    api.get<WorkOrderListResponse>('/api/work-orders?limit=100').then(d => { if (!cancelled) setWorkOrders(d.items); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  function validateFile(file: File, allowedTypes: string[], label: string): string | null {
    if (!allowedTypes.includes(file.type)) {
      return `${label}: Invalid file type. Allowed: ${allowedTypes.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${label}: File too large. Maximum 10 MB.`;
    }
    return null;
  }

  function handleVehicleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, ACCEPTED_IMAGE_TYPES, 'Vehicle photo');
    if (err) { setFileError(err); return; }
    setVehicleFile(file);
  }

  function handleDesignFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file, ACCEPTED_DESIGN_TYPES, 'Wrap design');
    if (err) { setFileError(err); return; }
    setDesignFile(file);
  }

  function resetForm() {
    setDesignName('');
    setVehicleFile(null);
    setDesignFile(null);
    setClientId('');
    setVehicleId('');
    setWorkOrderId('');
    setNotes('');
    setError('');
    setFileError('');
    setSubmitProgress('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleFile || !designFile || !designName.trim()) return;

    setIsSubmitting(true);
    setError('');
    setSubmitProgress('Uploading files...');

    try {
      // 1. Get presigned URLs
      const uploadRes = await api.post<RenderUploadResponse>('/api/renders/upload-urls', {
        files: [
          { filename: vehicleFile.name, content_type: vehicleFile.type, size_bytes: vehicleFile.size },
          { filename: designFile.name, content_type: designFile.type, size_bytes: designFile.size },
        ],
      });

      // 2. Upload to R2 using native fetch (NOT apiFetch!)
      await fetch(uploadRes.uploads[0].upload_url, {
        method: 'PUT',
        body: vehicleFile,
        headers: { 'Content-Type': vehicleFile.type },
      });
      await fetch(uploadRes.uploads[1].upload_url, {
        method: 'PUT',
        body: designFile,
        headers: { 'Content-Type': designFile.type },
      });

      // 3. Create render
      setSubmitProgress('Generating render...');
      await api.post('/api/renders', {
        design_name: designName.trim(),
        description: notes.trim() || undefined,
        vehicle_photo_key: uploadRes.uploads[0].r2_key,
        wrap_design_key: uploadRes.uploads[1].r2_key,
        client_id: clientId || undefined,
        vehicle_id: vehicleId || undefined,
        work_order_id: workOrderId || undefined,
      });

      resetForm();
      onCreate();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create render');
    } finally {
      setIsSubmitting(false);
      setSubmitProgress('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-render-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 id="new-render-title" className="text-lg font-semibold text-[#18181b]">New Render</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-[#a8a8b4] transition-colors hover:bg-gray-100 hover:text-[#18181b]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {fileError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{fileError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Design Name */}
          <div>
            <label htmlFor="design-name" className="mb-1.5 block text-sm font-medium text-[#18181b]">Design Name</label>
            <input
              id="design-name" type="text" value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="e.g. Fleet Branding v2" required
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Vehicle Photo */}
          <div>
            <label htmlFor="vehicle-photo" className="mb-1.5 block text-sm font-medium text-[#18181b]">Vehicle Photo</label>
            <input
              id="vehicle-photo" type="file" onChange={handleVehicleFile}
              accept="image/jpeg,image/png,image/webp" required
              className="w-full text-sm text-[#60606a] file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            {vehicleFile && <p className="mt-1 text-xs text-[#a8a8b4]">{vehicleFile.name} ({(vehicleFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>

          {/* Wrap Design */}
          <div>
            <label htmlFor="wrap-design" className="mb-1.5 block text-sm font-medium text-[#18181b]">Wrap Design</label>
            <input
              id="wrap-design" type="file" onChange={handleDesignFile}
              accept="image/jpeg,image/png,image/webp,application/pdf" required
              className="w-full text-sm text-[#60606a] file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
            {designFile && <p className="mt-1 text-xs text-[#a8a8b4]">{designFile.name} ({(designFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>

          {/* Client dropdown */}
          <div>
            <label htmlFor="client" className="mb-1.5 block text-sm font-medium text-[#18181b]">Client <span className="text-[#a8a8b4]">(optional)</span></label>
            <select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">— None —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Vehicle dropdown */}
          <div>
            <label htmlFor="vehicle" className="mb-1.5 block text-sm font-medium text-[#18181b]">Vehicle <span className="text-[#a8a8b4]">(optional)</span></label>
            <select id="vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">— None —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{[v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown'}</option>)}
            </select>
          </div>

          {/* Work Order dropdown */}
          <div>
            <label htmlFor="work-order" className="mb-1.5 block text-sm font-medium text-[#18181b]">Work Order <span className="text-[#a8a8b4]">(optional)</span></label>
            <select id="work-order" value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}
              className="w-full rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">— None —</option>
              {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.job_number}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="render-notes" className="mb-1.5 block text-sm font-medium text-[#18181b]">Notes / Instructions <span className="text-[#a8a8b4]">(optional)</span></label>
            <textarea
              id="render-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Full wrap, all panels, driver side focus..."
              rows={3}
              className="w-full resize-none rounded-lg border border-[#e6e6eb] px-3.5 py-2.5 text-sm text-[#18181b] placeholder-[#a8a8b4] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Progress indicator */}
          {submitProgress && (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              {submitProgress}
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={() => { resetForm(); onClose(); }} disabled={isSubmitting}
              className="flex-1 rounded-lg border border-[#e6e6eb] px-4 py-2.5 text-sm font-medium text-[#60606a] transition-colors hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || !vehicleFile || !designFile || !designName.trim()}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
              {isSubmitting ? 'Creating...' : 'Create Render'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
