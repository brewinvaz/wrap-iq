import { api } from '../api-client';

export type EquipmentType = 'printer' | 'laminator' | 'plotter' | 'other';

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  printer: 'Printer',
  laminator: 'Laminator',
  plotter: 'Plotter',
  other: 'Other',
};

export interface Equipment {
  id: string;
  name: string;
  serialNumber: string | null;
  equipmentType: EquipmentType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentStats {
  total: number;
  active: number;
  printers: number;
  other: number;
}

interface EquipmentRaw {
  id: string;
  name: string;
  serial_number: string | null;
  equipment_type: EquipmentType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapEquipment(raw: EquipmentRaw): Equipment {
  return {
    id: raw.id,
    name: raw.name,
    serialNumber: raw.serial_number,
    equipmentType: raw.equipment_type,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export async function fetchEquipment(
  search?: string,
  type?: EquipmentType,
  isActive?: boolean,
): Promise<{ items: Equipment[]; total: number }> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('equipment_type', type);
  if (isActive !== undefined) params.set('is_active', String(isActive));
  params.set('limit', '100');
  const qs = params.toString();
  const data = await api.get<{ items: EquipmentRaw[]; total: number }>(
    `/api/equipment${qs ? `?${qs}` : ''}`,
  );
  return { items: data.items.map(mapEquipment), total: data.total };
}

export async function fetchEquipmentStats(): Promise<EquipmentStats> {
  return api.get<EquipmentStats>('/api/equipment/stats');
}

export async function createEquipment(data: {
  name: string;
  serialNumber?: string;
  equipmentType: EquipmentType;
  isActive: boolean;
}): Promise<Equipment> {
  const raw = await api.post<EquipmentRaw>('/api/equipment', {
    name: data.name,
    serial_number: data.serialNumber || null,
    equipment_type: data.equipmentType,
    is_active: data.isActive,
  });
  return mapEquipment(raw);
}

export async function updateEquipment(
  id: string,
  data: {
    name?: string;
    serialNumber?: string;
    equipmentType?: EquipmentType;
    isActive?: boolean;
  },
): Promise<Equipment> {
  const payload: Record<string, unknown> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.serialNumber !== undefined) payload.serial_number = data.serialNumber;
  if (data.equipmentType !== undefined) payload.equipment_type = data.equipmentType;
  if (data.isActive !== undefined) payload.is_active = data.isActive;
  const raw = await api.patch<EquipmentRaw>(`/api/equipment/${id}`, payload);
  return mapEquipment(raw);
}

export async function deleteEquipment(id: string): Promise<void> {
  await api.delete(`/api/equipment/${id}`);
}
